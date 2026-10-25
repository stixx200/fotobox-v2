import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { NotificationService } from './notification.service';
import { PrintService } from './print.service';
import { ShareLink, ShareService } from './share.service';
import { ClientLogService } from './client-log.service';

/**
 * Print / share actions for a displayed photo with the UI state a kiosk needs:
 * busy flags (no double prints), success feedback and friendly errors.
 *
 * Provide it per component (`providers: [PhotoActionsService]`) so the state
 * (e.g. an open QR code) does not leak between screens.
 */
@Injectable()
export class PhotoActionsService {
  private readonly printService = inject(PrintService);
  private readonly shareService = inject(ShareService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly clientLog = inject(ClientLogService);

  readonly printing = signal(false);
  readonly sharing = signal(false);
  readonly shareLink = signal<ShareLink | null>(null);

  /** @returns `true` when the print job was handed to the printer. */
  async print(photoUrl: string | null): Promise<boolean> {
    if (!photoUrl || this.printing()) {
      return false;
    }
    this.printing.set(true);
    try {
      const success = await this.printService.printPhoto(photoUrl);
      if (success) {
        this.notification.success(this.translate.instant('PRINT.STARTED'));
      }
      return success;
    } finally {
      this.printing.set(false);
    }
  }

  share(photoUrl: string | null): void {
    if (!photoUrl || this.sharing()) {
      return;
    }
    this.sharing.set(true);
    this.shareService
      .createShareLink(photoUrl)
      .pipe(finalize(() => this.sharing.set(false)))
      .subscribe({
        next: (link) => this.shareLink.set(link),
        error: (error: unknown) => {
          this.clientLog.error('Share link failed', error);
          this.notification.error(this.translate.instant('SHARE.ERROR'));
        },
      });
  }

  closeShare(): void {
    this.shareLink.set(null);
  }
}
