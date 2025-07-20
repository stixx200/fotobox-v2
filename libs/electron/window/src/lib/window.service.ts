import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { Injectable } from '@nestjs/common';

export interface WindowOptions
  extends Electron.BrowserWindowConstructorOptions {
  url: string;
}

@Injectable()
export class WindowService {
  windows: Map<string, BrowserWindow> = new Map<string, BrowserWindow>();

  public getWindowCount(): number {
    return this.windows.size;
  }

  async open(windowId: string, options: WindowOptions) {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = options.width || Math.min(1280, workAreaSize.width || 1280);
    const height = options.height || Math.min(720, workAreaSize.height || 720);

    // Create the browser window.
    const window = new BrowserWindow({
      ...options,
      width: width,
      height: height,
      show: false,
      fullscreen: true,
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    });
    window.setMenu(null);
    window.center();

    // if main window is ready to show, close the splash window and show the main window
    window.once('ready-to-show', () => {
      window.show();
    });

    window.on('closed', () => {
      this.close(windowId);
    });

    await window.loadURL(options.url);
  }

  closeAll() {
    this.windows.forEach((window) => window.close());
    this.windows.clear();
  }

  close(windowId: string) {
    this.windows.delete(windowId);
  }
}
