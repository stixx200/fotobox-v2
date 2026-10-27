import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  template: `
    <div class="splash-screen kiosk-dark">
      <div
        class="splash-content"
        [attr.role]="errorMessage ? 'alert' : 'status'"
      >
        @if (errorMessage) {
          <mat-icon class="state-icon state-icon--error" aria-hidden="true"
            >cloud_off</mat-icon
          >
          <h1>{{ 'SPLASH.API_UNAVAILABLE_TITLE' | translate }}</h1>
          <p class="error-text">{{ errorMessage }}</p>
          <div class="splash-actions">
            <button
              matButton="filled"
              class="kiosk-action"
              (click)="retry.emit()"
            >
              <mat-icon>refresh</mat-icon>
              {{ 'SPLASH.RETRY' | translate }}
            </button>
            <a matButton="outlined" class="kiosk-action" routerLink="/debug">
              <mat-icon>bug_report</mat-icon>
              {{ 'DEBUG.VIEW_LOGS' | translate }}
            </a>
          </div>
        } @else {
          <mat-icon class="state-icon" aria-hidden="true"
            >photo_camera</mat-icon
          >
          <h1>Fotobox</h1>
          <mat-progress-bar mode="indeterminate" class="splash-progress" />
          <p>{{ 'SPLASH.CONNECTING' | translate }}</p>
          @if (slowStart) {
            <p class="slow-start-hint">
              {{ 'SPLASH.SLOW_START' | translate }}
            </p>
          }
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .splash-screen {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: radial-gradient(
          circle at 50% 40%,
          var(--mat-sys-surface-container-high) 0%,
          var(--mat-sys-surface) 70%
        );
        color: var(--mat-sys-on-surface);
        z-index: 9999;
      }

      .splash-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        max-width: 32rem;
        text-align: center;
      }

      h1 {
        margin: 0;
        font: var(--mat-sys-display-small);
      }

      p {
        margin: 0;
        font: var(--mat-sys-body-large);
        color: var(--mat-sys-on-surface-variant);
      }

      .slow-start-hint {
        font: var(--mat-sys-body-medium);
      }

      .error-text {
        margin-bottom: 16px;
      }

      .state-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: var(--mat-sys-primary);
      }

      .state-icon--error {
        color: var(--mat-sys-error);
      }

      .splash-progress {
        width: 240px;
        margin: 8px 0;
        border-radius: var(--mat-sys-corner-full);
      }

      .splash-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        justify-content: center;
      }
    `,
  ],
})
export class SplashScreenComponent {
  @Input() errorMessage: string | null = null;
  /** Starting takes longer than usual (e.g. the first start after setup). */
  @Input() slowStart = false;
  @Output() retry = new EventEmitter<void>();
}
