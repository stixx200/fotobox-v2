import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
@Component({
  selector: 'app-share-qr-overlay',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div
      class="share-qr-overlay kiosk-dark"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-qr-title"
      (click)="$event.stopPropagation()"
      (keydown.escape)="onClose($event)"
    >
      <div class="share-qr-panel">
        <h2 id="share-qr-title">{{ 'SHARE.TITLE' | translate }}</h2>
        <p class="share-qr-hint">{{ 'SHARE.SCAN_HINT' | translate }}</p>

        @if (qrError()) {
          <p class="share-qr-error">{{ 'SHARE.QR_ERROR' | translate }}</p>
        } @else if (qrDataUrl()) {
          <img
            class="share-qr-image"
            [src]="qrDataUrl()"
            [attr.alt]="'SHARE.QR_ALT' | translate"
          />
        } @else {
          <mat-spinner diameter="64"></mat-spinner>
        }

        @if (expiresAt) {
          <p class="share-qr-expiry">
            {{ 'SHARE.EXPIRES' | translate: { date: formattedExpiry() } }}
          </p>
        }

        <button
          matButton="filled"
          class="kiosk-action"
          (click)="onClose($event)"
        >
          <mat-icon>check</mat-icon>
          {{ 'SHARE.DONE' | translate }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .share-qr-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: color-mix(in srgb, var(--mat-sys-scrim) 72%, transparent);
        z-index: 60;
        cursor: default;
        animation: fade-in 0.2s ease-out;
      }

      .share-qr-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        max-width: min(92vw, 34rem);
        padding: 32px 40px;
        text-align: center;
        color: var(--mat-sys-on-surface);
        background: var(--mat-sys-surface-container-high);
        border-radius: var(--mat-sys-corner-extra-large);
        box-shadow: var(--mat-sys-level3);
      }

      h2 {
        margin: 0;
        font: var(--mat-sys-headline-medium);
      }

      .share-qr-hint {
        margin: 0;
        font: var(--mat-sys-title-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      .share-qr-image {
        width: min(60vh, 70vw, 20rem);
        height: min(60vh, 70vw, 20rem);
        background: #fff;
        padding: 12px;
        border-radius: var(--mat-sys-corner-large);
        box-sizing: border-box;
      }

      .share-qr-expiry {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      .share-qr-error {
        margin: 0;
        font: var(--mat-sys-body-large);
        color: var(--mat-sys-error);
      }

      button {
        margin-top: 8px;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
  ],
})
export class ShareQrOverlayComponent implements OnChanges {
  @Input({ required: true }) shareUrl!: string;
  @Input() expiresAt = '';
  @Output() closed = new EventEmitter<void>();

  readonly qrDataUrl = signal<string | null>(null);
  readonly qrError = signal(false);

  ngOnChanges(): void {
    this.qrDataUrl.set(null);
    this.qrError.set(false);
    void this.generateQr();
  }

  formattedExpiry(): string {
    if (!this.expiresAt) {
      return '';
    }
    try {
      return new Date(this.expiresAt).toLocaleString();
    } catch {
      return this.expiresAt;
    }
  }

  onClose(event: Event): void {
    event.stopPropagation();
    this.closed.emit();
  }

  private async generateQr(): Promise<void> {
    try {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(this.shareUrl, {
        width: 512,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.qrError.set(true);
    }
  }
}
