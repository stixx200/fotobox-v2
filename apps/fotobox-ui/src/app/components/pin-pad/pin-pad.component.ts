import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { PIN_LENGTH } from '../../services/pin.util';

let nextId = 0;

/** How long the wrong-PIN state (shake + message) stays visible. */
export const PIN_ERROR_MS = 1500;

/**
 * Touch-friendly PIN keypad (80 px keys) with progress dots, a shake on wrong
 * PINs and hardware-keyboard support. Emits the PIN as soon as all digits are
 * entered; the parent checks it and sets `error` when it is wrong.
 */
@Component({
  selector: 'app-pin-pad',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './pin-pad.component.html',
  styleUrl: './pin-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinPadComponent {
  /** Heading above the dots (already translated). */
  readonly title = input.required<string>();
  readonly length = input(PIN_LENGTH);
  readonly icon = input('lock');
  /** Shown while `error` is set (already translated). */
  readonly errorMessage = input('');
  /**
   * Wrong-PIN state; the pad clears it after {@link PIN_ERROR_MS} or as soon
   * as a new digit is typed.
   */
  readonly error = model(false);
  /** Whether the bottom-left key offers a way back. */
  readonly cancelable = input(true);
  /** Accessible label of the cancel key (already translated). */
  readonly cancelLabel = input('');

  readonly pinEntered = output<string>();
  readonly cancelled = output<void>();

  readonly titleId = `pin-pad-title-${nextId++}`;
  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  readonly pin = signal('');
  /** One entry per digit: `true` once entered. */
  readonly dots = computed(() =>
    Array.from({ length: this.length() }, (_, i) => i < this.pin().length),
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.error()) {
        return;
      }
      const timer = setTimeout(() => this.error.set(false), PIN_ERROR_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  pressDigit(digit: string): void {
    if (this.pin().length >= this.length()) {
      return;
    }
    const pin = this.pin() + digit;
    this.error.set(false);
    if (pin.length === this.length()) {
      this.pin.set('');
      this.pinEntered.emit(pin);
      return;
    }
    this.pin.set(pin);
  }

  deleteDigit(): void {
    this.pin.update((pin) => pin.slice(0, -1));
    this.error.set(false);
  }

  cancel(): void {
    if (this.cancelable()) {
      this.cancelled.emit();
    }
  }

  /** Operators may still use a hardware keyboard. */
  onKeydown(event: KeyboardEvent): void {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.pressDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.deleteDigit();
    } else if (event.key === 'Escape') {
      this.cancel();
    }
  }
}
