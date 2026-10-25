import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { RecoveryService } from './services/recovery.service';

@Component({
  selector: 'app-recovery-overlay',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div
      class="recovery-overlay kiosk-dark"
      role="alertdialog"
      aria-labelledby="recovery-title"
      aria-describedby="recovery-message"
    >
      <div class="recovery-content">
        <mat-icon class="error-icon" aria-hidden="true"
          >sentiment_dissatisfied</mat-icon
        >
        <h1 id="recovery-title">{{ 'RECOVERY.TITLE' | translate }}</h1>
        <p id="recovery-message" class="error-text">
          {{ 'RECOVERY.MESSAGE' | translate }}
        </p>
        <div class="recovery-actions">
          <button
            matButton="filled"
            class="kiosk-action"
            (click)="recovery.retryAfterError()"
          >
            <mat-icon>refresh</mat-icon>
            {{ 'RECOVERY.RETRY' | translate }}
          </button>
          <button
            matButton="outlined"
            class="kiosk-action"
            (click)="recovery.navigateToSettings()"
          >
            <mat-icon>settings</mat-icon>
            {{ 'RECOVERY.TO_SETTINGS' | translate }}
          </button>
        </div>
        <details class="error-details">
          <summary>{{ 'RECOVERY.DETAILS' | translate }}</summary>
          <code>{{ recovery.fatalError() }}</code>
        </details>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .recovery-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--mat-sys-surface);
        z-index: 10000;
      }

      .recovery-content {
        max-width: 36rem;
        padding: 40px 48px;
        border-radius: var(--mat-sys-corner-extra-large);
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface);
        box-shadow: var(--mat-sys-level3);
        text-align: center;
      }

      h1 {
        margin: 16px 0 8px;
        font: var(--mat-sys-headline-medium);
      }

      .error-text {
        margin: 0 0 28px;
        font: var(--mat-sys-body-large);
        color: var(--mat-sys-on-surface-variant);
      }

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-error);
      }

      .recovery-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        justify-content: center;
      }

      .error-details {
        margin-top: 24px;
        text-align: left;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);

        summary {
          cursor: pointer;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        code {
          display: block;
          padding: 12px;
          border-radius: var(--mat-sys-corner-small);
          background: var(--mat-sys-surface-container-lowest);
          word-break: break-word;
          user-select: text;
        }
      }
    `,
  ],
})
export class RecoveryOverlayComponent {
  readonly recovery = inject(RecoveryService);
}
