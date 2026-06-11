/**
 * Inter-process communication between the Angular renderer and the Electron
 * main process. Kept intentionally small: configuration and camera/printer
 * features go through the GraphQL API, not IPC.
 */
import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('electron-events');

let registered = false;

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
  ipcMain.handle('print-photo', async (_event, photoUrl: string) => {
    return printPhoto(photoUrl);
  });

  // App termination
  ipcMain.on('quit', (_event, code: number) => {
    app.exit(code ?? 0);
  });
}

async function printPhoto(
  photoUrl: string,
): Promise<{ success: boolean; reason?: string }> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { backgroundThrottling: false },
  });

  const html = `<!DOCTYPE html><html><head><style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; height: 100%; }
    img { width: 100%; height: 100%; object-fit: contain; }
  </style></head><body><img src="${photoUrl}" /></body></html>`;

  try {
    await printWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(html),
    );

    return await new Promise((resolve) => {
      printWindow.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
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
