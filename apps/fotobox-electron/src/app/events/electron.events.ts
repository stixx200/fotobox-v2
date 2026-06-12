/**
 * Inter-process communication between the Angular renderer and the Electron
 * main process. Kept intentionally small: configuration and camera/printer
 * features go through the GraphQL API, not IPC.
 */
import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('electron-events');

let registered = false;

interface PrintPhotoOptions {
  printerName?: string;
  silent?: boolean;
  landscape?: boolean;
}

export function registerElectronEvents(): void {
  if (registered) {
    return;
  }
  registered = true;

  // Retrieve app version
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Directory picker dialog (used by the settings screen on the host)
  ipcMain.handle('open-directory-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Ordner auswählen',
    });

    return result.canceled ? null : result.filePaths[0];
  });

  // Print a photo by URL using a hidden window + webContents.print.
  ipcMain.handle(
    'print-photo',
    async (_event, photoUrl: string, options?: PrintPhotoOptions) => {
      return printPhoto(photoUrl, options);
    },
  );

  // App termination
  ipcMain.on('quit', (_event, code: number) => {
    app.exit(code ?? 0);
  });
}

async function waitForPrintImage(
  printWindow: BrowserWindow,
): Promise<void> {
  await printWindow.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = document.querySelector('img');
      if (!img) {
        reject(new Error('Print page has no image'));
        return;
      }
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => reject(new Error('Image failed to load')), {
        once: true,
      });
    })
  `);
}

async function printPhoto(
  photoUrl: string,
  options: PrintPhotoOptions = {},
): Promise<{ success: boolean; reason?: string }> {
  const silent = options.silent ?? true;
  const landscape = options.landscape ?? true;
  const printerName = options.printerName?.trim();

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { backgroundThrottling: false },
  });

  const html = `<!DOCTYPE html><html><head><style>
    @page { size: landscape; margin: 0; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; }
    img { width: 100%; height: 100%; object-fit: contain; }
  </style></head><body><img src="${photoUrl}" /></body></html>`;

  try {
    await printWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(html),
    );
    await waitForPrintImage(printWindow);

    return await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent,
          printBackground: true,
          landscape,
          margins: { marginType: 'none' },
          ...(printerName ? { deviceName: printerName } : {}),
        },
        (success, failureReason) => {
          if (!success) {
            logger.warn('Photo print failed', {
              failureReason,
              printerName: printerName ?? '(system default)',
              silent,
            });
          }
          resolve({ success, reason: success ? undefined : failureReason });
        },
      );
    });
  } catch (error) {
    logger.error('Failed to print photo:', error);
    return { success: false, reason: String(error) };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}
