import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getLogger } from '@fotobox/logging';
import { APP_NAME, getAppIcon } from './app-branding';

const logger = getLogger('collage-editor-window');

let editorWindow: BrowserWindow | null = null;

function getCollageEditorUrl(): string {
  return (
    process.env.FOTOBOX_COLLAGE_EDITOR_DEV_SERVER ||
    pathToFileURL(
      join(__dirname, 'collage-editor-ui/index.html'),
    ).toString()
  );
}

function resolveApiUrl(): string {
  if (process.env.FOTOBOX_API_URL) {
    return process.env.FOTOBOX_API_URL.replace(/\/+$/, '');
  }
  const port = Number(process.env.PORT) || 3000;
  return `http://localhost:${port}`;
}

export function openCollageEditorWindow(collageDirectory?: string): void {
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.focus();
    if (collageDirectory) {
      void editorWindow.loadURL(buildEditorUrl(collageDirectory));
    }
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  editorWindow = new BrowserWindow({
    width: Math.min(width, 1600),
    height: Math.min(height, 1000),
    title: `${APP_NAME} Collage Editor`,
    icon: getAppIcon(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, 'main.preload.js'),
      additionalArguments: [`--fotobox-api-url=${resolveApiUrl()}`],
    },
  });

  editorWindow.once('ready-to-show', () => editorWindow?.show());
  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  const url = buildEditorUrl(collageDirectory);
  logger.info(`Opening collage editor at ${url}`);
  void editorWindow.loadURL(url);
}

function buildEditorUrl(collageDirectory?: string): string {
  const base = getCollageEditorUrl();
  if (!collageDirectory) {
    return base;
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}dir=${encodeURIComponent(collageDirectory)}`;
}
