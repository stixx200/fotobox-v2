import {
  Component,
  EventEmitter,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Full-screen countdown overlay used before capturing a photo.
 *
 * Self-contained timer: the parent calls {@link start} with the number of
 * seconds and listens for {@link completed}. {@link abort} cancels it.
 * When the count reaches zero a short "smile" moment is shown before
 * `completed` fires.
 */
@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (value() !== null) {
      <div class="countdown-overlay">
        <div class="countdown-number" [class.smile]="value() === 0">
          @if (value() === 0) {
            {{ 'COUNTDOWN.SMILE' | translate }}
          } @else {
            {{ value() }}
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .countdown-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.45);
        z-index: 20;
      }

      .countdown-number {
        color: #fff;
        font-weight: 700;
        font-size: clamp(6rem, 30vw, 18rem);
        line-height: 1;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
        animation: pop 1s ease-out;
      }

      .countdown-number.smile {
        font-size: clamp(3rem, 12vw, 8rem);
        animation: smile-pop 0.4s ease-out;
      }

      @keyframes pop {
        0% {
          transform: scale(0.4);
          opacity: 0;
        }
        40% {
          transform: scale(1.15);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes smile-pop {
        0% {
          transform: scale(0.6);
          opacity: 0;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
    `,
  ],
})
export class CountdownComponent implements OnDestroy {
  /** Emits once the countdown (including the smile moment) finishes. */
  @Output() completed = new EventEmitter<void>();

  readonly value = signal<number | null>(null);

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private smileHandle: ReturnType<typeof setTimeout> | null = null;

  /** Whether a countdown is currently running. */
  get isRunning(): boolean {
    return this.value() !== null;
  }

  /**
   * Start the countdown from the given number of seconds.
   */
  start(seconds: number): void {
    this.abort();
    const start = Math.max(0, Math.floor(seconds));
    this.value.set(start);

    if (start === 0) {
      this.showSmileThenComplete();
      return;
    }

    this.tickHandle = setInterval(() => {
      const current = this.value();
      if (current === null) {
        return;
      }
      if (current > 1) {
        this.value.set(current - 1);
      } else {
        this.clearTick();
        this.value.set(0);
        this.showSmileThenComplete();
      }
    }, 1000);
  }

  /**
   * Cancel a running countdown without emitting `completed`.
   */
  abort(): void {
    this.clearTick();
    if (this.smileHandle) {
      clearTimeout(this.smileHandle);
      this.smileHandle = null;
    }
    this.value.set(null);
  }

  ngOnDestroy(): void {
    this.abort();
  }

  private showSmileThenComplete(): void {
    this.smileHandle = setTimeout(() => {
      this.smileHandle = null;
      this.value.set(null);
      this.completed.emit();
    }, 800);
  }

  private clearTick(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }
}
