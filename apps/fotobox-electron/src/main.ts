import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { bootstrapApiServer } from '@fotobox/nest-api';
import { registerElectronEvents } from './app/events/electron.events';

const logger = getLogger('fotobox-electron');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

let mainWindow: BrowserWindow | null = null;
let apiApp: INestApplication | null = null;

/**
 * Resolve the API URL the renderer should talk to. By default the Electron
 * host runs the API in-process on localhost. Set FOTOBOX_API_URL to point the
 * kiosk window at an external API instead (e.g. a shared server).
 */
function resolveApiUrl(): string {
  if (process.env.FOTOBOX_API_URL) {
    return process.env.FOTOBOX_API_URL.replace(/\/+$/, '');
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

function getUIUrl(): string {
  const url =
    process.env.FOTOBOX_DEV_SERVER ||
    pathToFileURL(join(__dirname, 'fotobox-ui/index.html')).toString();
  logger.info(`Loading UI from: ${url}`);
  return url;
}

/**
 * Start the backend in-process unless an external API is configured. Reuses the
 * exact same module as the standalone `fotobox-api` server.
 */
async function startEmbeddedApi(): Promise<void> {
  if (process.env.FOTOBOX_API_URL) {
    logger.info(`Using external API at ${process.env.FOTOBOX_API_URL}`);
    return;
  }

  // Persist settings under the OS user-data directory when acting as the host.
  if (!process.env.FOTOBOX_SETTINGS_PATH) {
    process.env.FOTOBOX_SETTINGS_PATH = join(
      app.getPath('userData'),
      'settings.json',
    );
  }

  apiApp = await bootstrapApiServer({ port: DEFAULT_PORT, host: '127.0.0.1' });
}

async function createWindow(): Promise<void> {
  const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
  const isProd = !process.env.FOTOBOX_DEV_SERVER;

  mainWindow = new BrowserWindow({
    width: workAreaSize.width || 1280,
    height: workAreaSize.height || 720,
    show: false,
    // Kiosk mode in production keeps the app fullscreen on Windows and
    // prevents the user from exiting with Escape or Alt+F4.
    kiosk: isProd,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
      // Disable dev tools in production to keep the kiosk clean.
      devTools: !isProd,
      preload: join(__dirname, 'main.preload.js'),
      additionalArguments: [`--fotobox-api-url=${resolveApiUrl()}`],
    },
  });

  mainWindow.setMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(getUIUrl());
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  registerElectronEvents();

  try {
    await startEmbeddedApi();
  } catch (error) {
    logger.error('Failed to start embedded API server:', error);
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (apiApp) {
    await apiApp.close().catch(() => undefined);
    apiApp = null;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

bootstrap().catch((error) => {
  logger.error('Electron bootstrap failed:', error);
  app.quit();
});
