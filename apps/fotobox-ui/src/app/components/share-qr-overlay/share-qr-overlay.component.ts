import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
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
    <div class="share-qr-overlay" (click)="$event.stopPropagation()">
      <div class="share-qr-panel">
        <h2>{{ 'SHARE.TITLE' | translate }}</h2>
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

        <button mat-raised-button color="primary" (click)="onClose($event)">
          <mat-icon>check</mat-icon>
          {{ 'SHARE.DONE' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .share-qr-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.88);
        z-index: 60;
      }

      .share-qr-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        max-width: min(90vw, 28rem);
        padding: 2rem;
        text-align: center;
        color: #fff;
      }

      h2 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .share-qr-hint {
        margin: 0;
        font-size: 1.125rem;
        color: rgba(255, 255, 255, 0.8);
      }

      .share-qr-image {
        width: min(70vw, 16rem);
        height: min(70vw, 16rem);
        background: #fff;
        padding: 0.75rem;
        border-radius: 0.5rem;
      }

      .share-qr-expiry {
        margin: 0;
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .share-qr-error {
        margin: 0;
        color: #ff8a80;
      }

      button {
        min-width: 12rem;
        min-height: 3.5rem;
        font-size: 1.125rem;
        margin-top: 0.5rem;
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
