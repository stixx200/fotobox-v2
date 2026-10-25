import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Presentational overlay that shows a captured photo (or collage) together with
 * print / share / back actions. The host decides which actions are offered and
 * what the back action does.
 *
 * Hierarchy follows M3: the first offered action (print, else share) is the
 * filled primary button, further actions are tonal, "done" is outlined.
 */
@Component({
  selector: 'app-photo-view',
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
      class="photo-view kiosk-dark"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'PHOTO_VIEW.ALT' | translate"
      (click)="$event.stopPropagation()"
      (keydown.escape)="onBack($event)"
    >
      <div class="photo-frame">
        <img [src]="src" [attr.alt]="'PHOTO_VIEW.ALT' | translate" />
      </div>

      <div class="photo-actions">
        @if (showPrint) {
          <button
            matButton="filled"
            class="kiosk-action"
            data-testid="photo-print"
            [disabled]="printing"
            (click)="onPrint($event)"
          >
            @if (printing) {
              <mat-spinner diameter="24" class="button-spinner" />
            } @else {
              <mat-icon>print</mat-icon>
            }
            {{
              (printing ? 'PHOTO_VIEW.PRINTING' : 'PHOTO_VIEW.PRINT')
                | translate
            }}
          </button>
        }
        @if (showShare) {
          <button
            [matButton]="showPrint ? 'tonal' : 'filled'"
            class="kiosk-action"
            data-testid="photo-share"
            [disabled]="sharing"
            (click)="onShare($event)"
          >
            @if (sharing) {
              <mat-spinner diameter="24" class="button-spinner" />
            } @else {
              <mat-icon>qr_code_2</mat-icon>
            }
            {{ 'PHOTO_VIEW.SHARE' | translate }}
          </button>
        }
        <button
          [matButton]="showPrint || showShare ? 'outlined' : 'filled'"
          class="kiosk-action"
          data-testid="photo-back"
          (click)="onBack($event)"
        >
          <mat-icon>{{ backIcon }}</mat-icon>
          {{ backLabel | translate }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .photo-view {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: clamp(16px, 3vh, 32px);
        padding: clamp(16px, 3vh, 32px) clamp(16px, 3vw, 48px);
        box-sizing: border-box;
        background: var(--mat-sys-surface-container-lowest);
        z-index: 15;
        cursor: default;
        animation: photo-in 0.28s cubic-bezier(0.2, 0, 0, 1);
      }

      .photo-frame {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: var(--mat-sys-corner-large);
        box-shadow: var(--mat-sys-level3);
      }

      .photo-actions {
        flex: 0 0 auto;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
      }

      .button-spinner {
        display: inline-block;
        margin-inline-end: 8px;
        vertical-align: middle;
      }

      @keyframes photo-in {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .photo-view {
          animation: none;
        }
      }
    `,
  ],
})
export class PhotoViewComponent {
  /** Image source (URL or data URI) to display. */
  @Input({ required: true }) src!: string;

  /** Whether to offer the print button. */
  @Input() showPrint = true;

  /** Whether to offer the share button. */
  @Input() showShare = false;

  /** A print job is being sent — disables the button and shows progress. */
  @Input() printing = false;

  /** A share link is being created. */
  @Input() sharing = false;

  /** Label (translation key) for the secondary (back) button. */
  @Input() backLabel = 'PHOTO_VIEW.DONE';

  /** Material icon for the secondary button. */
  @Input() backIcon = 'check';

  @Output() print = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  onPrint(event: Event): void {
    event.stopPropagation();
    this.print.emit();
  }

  onShare(event: Event): void {
    event.stopPropagation();
    this.share.emit();
  }

  onBack(event: Event): void {
    event.stopPropagation();
    this.back.emit();
  }
}
