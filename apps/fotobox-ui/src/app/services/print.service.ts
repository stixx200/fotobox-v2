import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SettingsStore } from '../store';
import { ClientLogService } from './client-log.service';
import { NotificationService } from './notification.service';

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
  private readonly notificationService = inject(NotificationService);
  private readonly clientLogService = inject(ClientLogService);
  private readonly translateService = inject(TranslateService);

  /**
   * Print a single photo.
   *
   * - In Electron: prints to the configured printer; silent unless
   *   `showPrintDialog` is enabled in settings.
   * - In a plain browser: opens a minimal print page; the dialog cannot be
   *   suppressed due to browser security restrictions.
   *
   * @returns `true` when printing succeeded or was handed off to the browser.
   */
  async printPhoto(photoUrl: string): Promise<boolean> {
    const options: PrintPhotoOptions = {
      printerName: this.getStringSetting('printerName'),
      silent: !this.getBooleanSetting('showPrintDialog', false),
      landscape: true,
    };

    if (typeof window !== 'undefined' && window.electron?.printPhoto) {
      try {
        const result = await window.electron.printPhoto(photoUrl, options);
        if (!result.success) {
          this.reportPrintFailure(result.reason);
          return false;
        }
        return true;
      } catch (error) {
        this.reportPrintFailure(error);
        return false;
      }
    }

    const opened = this.printInBrowser(photoUrl);
    if (!opened) {
      this.reportPrintFailure('Popup blocked');
      return false;
    }
    return true;
  }

  private reportPrintFailure(detail?: unknown): void {
    this.notificationService.error(
      this.translateService.instant('PRINT.ERROR'),
    );
    this.clientLogService.error('Photo print failed', detail);
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

  private printInBrowser(photoUrl: string): boolean {
    const win = window.open('', '_blank');
    if (!win) {
      return false;
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
    return true;
  }
}
