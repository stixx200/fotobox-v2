import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { bootstrapApiServer } from '@fotobox/nest-api';
import { APP_NAME, applyAppBranding, getAppIcon } from './app/app-branding';
import { registerElectronEvents } from './app/events/electron.events';
import { runProductionKioskSetup } from './app/kiosk-setup';
import { setMainWindow } from './app/window-state';
import { createApiHealthWatch } from './app/api-health-watch';
import {
  DEFAULT_API_PORT,
  resolveApiUrl,
  usesExternalApi,
} from './app/api-endpoint';

const logger = getLogger('fotobox-electron');

const API_START_MAX_ATTEMPTS = 5;
const API_START_RETRY_DELAY_MS = 2000;
const API_HEALTH_INTERVAL_MS = 30_000;
const API_HEALTH_MAX_FAILURES = 3;

let mainWindow: BrowserWindow | null = null;
let apiApp: INestApplication | null = null;
let isQuitting = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relaunchApp(reason: string): void {
  if (isQuitting) {
    return;
  }
  isQuitting = true;
  logger.error(`Relaunching app: ${reason}`);
  app.relaunch();
  app.exit(0);
}

function getUIUrl(): string {
  const url =
    process.env.FOTOBOX_DEV_SERVER ||
    pathToFileURL(join(__dirname, 'fotobox-ui/index.html')).toString();
  logger.info(`Loading UI from: ${url}`);
  return url;
}

/**
 * Start the backend in-process. Reuses the exact same module as the
 * standalone `fotobox-api` server.
 */
async function startEmbeddedApi(): Promise<void> {
  // Persist settings under the OS user-data directory when acting as the host.
  if (!process.env.FOTOBOX_SETTINGS_PATH) {
    process.env.FOTOBOX_SETTINGS_PATH = join(
      app.getPath('userData'),
      'settings.json',
    );
  }
  if (!process.env.FOTOBOX_DATABASE_PATH) {
    process.env.FOTOBOX_DATABASE_PATH = join(
      app.getPath('userData'),
      'fotobox.db',
    );
  }

  // Bind on all interfaces so guest phones (QR share) and tablets on the LAN
  // can reach the API. The kiosk UI still talks to localhost via preload.
  apiApp = await bootstrapApiServer({
    port: DEFAULT_API_PORT,
    host: '0.0.0.0',
  });
}

async function startEmbeddedApiWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= API_START_MAX_ATTEMPTS; attempt++) {
    try {
      await startEmbeddedApi();
      return;
    } catch (error) {
      logger.error(
        `Embedded API start attempt ${attempt}/${API_START_MAX_ATTEMPTS} failed:`,
        error,
      );
      if (attempt === API_START_MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(API_START_RETRY_DELAY_MS * attempt);
    }
  }
}

async function stopEmbeddedApi(): Promise<void> {
  const current = apiApp;
  apiApp = null;
  if (current) {
    await current.close().catch((error) => {
      logger.error('Failed to close embedded API:', error);
    });
  }
}

async function restartEmbeddedApi(): Promise<boolean> {
  await stopEmbeddedApi();
  try {
    await startEmbeddedApiWithRetry();
    return true;
  } catch (error) {
    logger.error('Failed to restart embedded API:', error);
    return false;
  }
}

async function checkEmbeddedApiHealth(): Promise<boolean> {
  if (!apiApp) {
    return false;
  }
  const response = await fetch(`http://127.0.0.1:${DEFAULT_API_PORT}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}

/**
 * Runs even when the initial start failed, so the kiosk keeps trying to bring
 * the backend up (and finally relaunches) instead of showing a dead UI.
 */
function startEmbeddedApiHealthWatch(): void {
  const watch = createApiHealthWatch({
    check: checkEmbeddedApiHealth,
    restart: restartEmbeddedApi,
    relaunch: relaunchApp,
    maxFailures: API_HEALTH_MAX_FAILURES,
    onError: (message, error) => logger.error(message, error),
  });
  setInterval(() => void watch.tick(), API_HEALTH_INTERVAL_MS);
}

function attachWindowRecoveryHandlers(window: BrowserWindow): void {
  const uiUrl = getUIUrl();

  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Renderer process gone', details);
    relaunchApp(`renderer crashed (${details.reason})`);
  });

  window.on('unresponsive', () => {
    logger.warn('Window became unresponsive, reloading renderer');
    if (!window.isDestroyed()) {
      window.webContents.reload();
    }
  });

  window.webContents.on('responsive', () => {
    logger.info('Window responsive again');
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('Page failed to load', {
        errorCode,
        errorDescription,
        validatedURL,
      });
      setTimeout(() => {
        if (!window.isDestroyed()) {
          void window.loadURL(uiUrl);
        }
      }, 3000);
    },
  );
}

async function createWindow(): Promise<void> {
  const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
  const isProd = !process.env.FOTOBOX_DEV_SERVER;

  mainWindow = new BrowserWindow({
    width: workAreaSize.width || 1280,
    height: workAreaSize.height || 720,
    title: APP_NAME,
    icon: getAppIcon(),
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
    setMainWindow(null);
  });

  setMainWindow(mainWindow);

  attachWindowRecoveryHandlers(mainWindow);

  await mainWindow.loadURL(getUIUrl());
}

async function bootstrap(): Promise<void> {
  applyAppBranding();
  await app.whenReady();
  registerElectronEvents();

  await runProductionKioskSetup();

  if (usesExternalApi()) {
    logger.info(`Using external API at ${resolveApiUrl()}`);
  } else {
    try {
      await startEmbeddedApiWithRetry();
    } catch (error) {
      logger.error('Failed to start embedded API server after retries:', error);
    }
    startEmbeddedApiHealthWatch();
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

// Electron does not await async 'before-quit' listeners: hold the quit until
// the API has released its port and database, then quit for real.
app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }
  isQuitting = true;
  if (!apiApp) {
    return;
  }
  event.preventDefault();
  void stopEmbeddedApi().finally(() => app.quit());
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
});

// After an uncaught exception the process is in an unknown state; a kiosk is
// better off restarting cleanly than limping on.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  relaunchApp(`uncaught exception: ${error.message}`);
});

bootstrap().catch((error) => {
  logger.error('Electron bootstrap failed:', error);
  app.quit();
});
