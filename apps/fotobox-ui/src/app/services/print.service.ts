import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '../store';
import { ClientLogService } from './client-log.service';
import { NotificationService } from './notification.service';

const PRINT_PHOTO = gql`
  mutation PrintPhoto($input: PrintPhotoInput!) {
    printPhoto(input: $input) {
      success
      message
    }
  }
`;

interface PrintResult {
  success: boolean;
  message?: string | null;
}

/** `https://host:5100/api/photos/photo-1.jpg?token=…` → `photo-1.jpg` */
export function photoFilenameFromUrl(photoUrl: string): string | null {
  try {
    const { pathname } = new URL(photoUrl, 'http://localhost');
    const match = /^\/api\/photos\/([^/]+)$/.exec(pathname);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly apollo = inject(Apollo);
  private readonly settingsStore = inject(SettingsStore);
  private readonly notificationService = inject(NotificationService);
  private readonly clientLogService = inject(ClientLogService);
  private readonly translateService = inject(TranslateService);

  /**
   * Print a single photo.
   *
   * By default the host prints it silently on the configured printer (works
   * from the kiosk and from tablets). With `showPrintDialog` enabled, the
   * browser print dialog is used instead.
   *
   * @returns `true` when printing succeeded or was handed off to the browser.
   */
  async printPhoto(photoUrl: string): Promise<boolean> {
    if (this.getBooleanSetting('showPrintDialog', false)) {
      const opened = this.printInBrowser(photoUrl);
      if (!opened) {
        this.reportPrintFailure('Popup blocked');
      }
      return opened;
    }

    const filename = photoFilenameFromUrl(photoUrl);
    if (!filename) {
      this.reportPrintFailure(`Not a stored photo: ${photoUrl}`);
      return false;
    }

    try {
      const result = await firstValueFrom(
        this.apollo.mutate<{ printPhoto: PrintResult }>({
          mutation: PRINT_PHOTO,
          variables: {
            input: {
              filename,
              printerName: this.getStringSetting('printerName'),
              landscape: true,
            },
          },
        }),
      );
      const outcome = result.data?.printPhoto;
      if (!outcome?.success) {
        this.reportPrintFailure(outcome?.message ?? result.error);
        return false;
      }
      return true;
    } catch (error) {
      this.reportPrintFailure(error);
      return false;
    }
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
