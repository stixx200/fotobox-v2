import { Component, inject } from '@angular/core';
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
    <div class="recovery-overlay">
      <div class="recovery-content">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <h1>{{ 'RECOVERY.TITLE' | translate }}</h1>
        <p class="error-text">{{ recovery.fatalError() }}</p>
        <div class="recovery-actions">
          <button
            mat-raised-button
            color="primary"
            (click)="recovery.navigateToSettings()"
          >
            {{ 'RECOVERY.TO_SETTINGS' | translate }}
          </button>
          <button mat-stroked-button (click)="recovery.retryAfterError()">
            {{ 'RECOVERY.RETRY' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .recovery-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
      }

      .recovery-content {
        text-align: center;
        color: white;
        max-width: 480px;
        padding: 24px;
      }

      h1 {
        font-size: 1.75rem;
        margin: 16px 0 8px;
        font-weight: 400;
      }

      .error-text {
        margin-bottom: 24px;
        line-height: 1.5;
        opacity: 0.9;
        word-break: break-word;
      }

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      .recovery-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
      }
    `,
  ],
})
export class RecoveryOverlayComponent {
  readonly recovery = inject(RecoveryService);
}
