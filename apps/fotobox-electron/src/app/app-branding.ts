import { app, nativeImage } from 'electron';
import { join } from 'node:path';

export const APP_NAME = 'Fotobox';

const iconPath = join(__dirname, 'assets/icon.png');

export function getAppIcon() {
  return nativeImage.createFromPath(iconPath);
}

/** Apply dock/menu branding before windows are created (dev shows "Electron" otherwise). */
export function applyAppBranding(): void {
  app.setName(APP_NAME);

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(getAppIcon());
  }
}
