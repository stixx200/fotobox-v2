import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div class="splash-screen">
      <div class="splash-content">
        @if (errorMessage) {
          <mat-icon class="error-icon">error_outline</mat-icon>
          <h1>Fotobox</h1>
          <p class="error-text">{{ errorMessage }}</p>
          <div class="splash-actions">
            <button mat-raised-button color="primary" (click)="retry.emit()">
              {{ 'SPLASH.RETRY' | translate }}
            </button>
            <a mat-stroked-button routerLink="/debug" class="debug-link">
              {{ 'DEBUG.VIEW_LOGS' | translate }}
            </a>
          </div>
        } @else {
          <div class="loader"></div>
          <h1>Fotobox</h1>
          <p>{{ 'SPLASH.CONNECTING' | translate }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .splash-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 9999;
      }

      .splash-content {
        text-align: center;
        color: white;
        max-width: 420px;
        padding: 24px;
      }

      h1 {
        font-size: 2.5rem;
        margin: 20px 0 10px 0;
        font-weight: 300;
        letter-spacing: 2px;
      }

      p {
        font-size: 1rem;
        margin: 0;
        opacity: 0.9;
      }

      .error-text {
        margin-bottom: 20px;
        line-height: 1.5;
      }

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      .splash-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
      }

      .debug-link {
        color: white !important;
        border-color: rgba(255, 255, 255, 0.7) !important;
      }

      .loader {
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid white;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SplashScreenComponent {
  @Input() errorMessage: string | null = null;
  @Output() retry = new EventEmitter<void>();
}
