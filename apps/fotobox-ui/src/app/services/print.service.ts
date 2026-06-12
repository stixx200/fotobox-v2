import { Injectable, inject } from '@angular/core';
import { SettingsStore } from '../store';

export interface PrintPhotoOptions {
  /** OS printer name from settings. Uses the system default when omitted. */
  printerName?: string;
  /** Skip the native print dialog (Electron only). */
  silent?: boolean;
  /** Print in landscape orientation. */
  landscape?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly settingsStore = inject(SettingsStore);

  /**
   * Print a single photo.
   *
   * - In Electron: prints to the configured printer; silent unless
   *   `showPrintDialog` is enabled in settings.
   * - In a plain browser: opens a minimal print page; the dialog cannot be
   *   suppressed due to browser security restrictions.
   */
  printPhoto(photoUrl: string): void {
    const options: PrintPhotoOptions = {
      printerName: this.getStringSetting('printerName'),
      silent: !this.getBooleanSetting('showPrintDialog', false),
      landscape: true,
    };

    if (typeof window !== 'undefined' && window.electron?.printPhoto) {
      window.electron.printPhoto(photoUrl, options).catch((err) => {
        console.error('Electron print failed:', err);
      });
      return;
    }

    this.printInBrowser(photoUrl);
  }

  private getStringSetting(key: string): string | undefined {
    const setting = this.settingsStore
      .settings()
      .find((entry) => entry.key === key);
    if (!setting) {
      return undefined;
    }

    try {
      const value = JSON.parse(setting.value);
      return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
    } catch {
      return undefined;
    }
  }

  private getBooleanSetting(key: string, defaultValue: boolean): boolean {
    const setting = this.settingsStore
      .settings()
      .find((entry) => entry.key === key);
    if (!setting) {
      return defaultValue;
    }

    try {
      const value = JSON.parse(setting.value);
      return typeof value === 'boolean' ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private printInBrowser(photoUrl: string): void {
    const win = window.open('', '_blank');
    if (!win) {
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Drucken</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: landscape; margin: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <img src="${photoUrl}" onload="window.print(); window.close();" />
</body>
</html>`);
    win.document.close();
  }
}
