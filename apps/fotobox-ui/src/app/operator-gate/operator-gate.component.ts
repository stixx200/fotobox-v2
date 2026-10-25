import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, firstValueFrom } from 'rxjs';
import { SettingsStore } from '../store';
import { SettingsComponent } from '../settings/settings.component';
import { PinPadComponent } from '../components/pin-pad/pin-pad.component';
import { OperatorAccessService } from '../services/operator-access.service';
import {
  FotoboxStartService,
  savedStartConfig,
} from '../services/fotobox-start.service';

/** Route data flag: the start route may skip straight into the guest flow. */
export const AUTO_START_ROUTE_DATA = 'autoStart';

export type OperatorGateState = 'checking' | 'starting' | 'locked' | 'open';

/**
 * Entry to the operator settings (start route and /settings). Waits for the
 * saved settings, then either auto-starts the booth (start route only), asks
 * for the operator PIN, or shows the settings.
 */
@Component({
  selector: 'app-operator-gate',
  standalone: true,
  imports: [
    MatProgressSpinnerModule,
    TranslatePipe,
    PinPadComponent,
    SettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('open') {
        <app-settings />
      }
      @case ('locked') {
        <div class="operator-gate kiosk-dark">
          <app-pin-pad
            [title]="'OPERATOR.ENTER_PIN' | translate"
            icon="admin_panel_settings"
            [errorMessage]="'OPERATOR.WRONG_PIN' | translate"
            [cancelable]="canReturnToFotobox()"
            [cancelLabel]="'OPERATOR.BACK_TO_FOTOBOX' | translate"
            [(error)]="pinError"
            (pinEntered)="submitPin($event)"
            (cancelled)="returnToFotobox()"
          />
          @if (startError()) {
            <p class="operator-gate__error" role="alert">
              {{ 'SETTINGS.START_FAILED' | translate }}
            </p>
          }
        </div>
      }
      @default {
        <div class="operator-gate kiosk-dark" role="status">
          <mat-spinner diameter="48" />
          <p class="operator-gate__status">
            {{
              (state() === 'starting'
                ? 'OPERATOR.STARTING'
                : 'OPERATOR.LOADING'
              ) | translate
            }}
          </p>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .operator-gate {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px;
      box-sizing: border-box;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }

    .operator-gate__status {
      margin: 0;
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .operator-gate__error {
      max-width: 32rem;
      margin: 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-error);
      text-align: center;
    }
  `,
})
export class OperatorGateComponent implements OnInit {
  private readonly settingsStore = inject(SettingsStore);
  private readonly access = inject(OperatorAccessService);
  private readonly fotoboxStart = inject(FotoboxStartService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  readonly state = signal<OperatorGateState>('checking');
  readonly pinError = signal(false);
  readonly startError = this.fotoboxStart.error;
  /** Guests can only be sent back when the saved settings would start. */
  readonly canReturnToFotobox = computed(
    () => savedStartConfig(this.settingsStore.settings()) !== null,
  );

  ngOnInit(): void {
    void this.decide();
  }

  /** Called by the keypad once all digits are entered. */
  submitPin(pin: string): void {
    if (this.access.tryUnlock(pin)) {
      this.pinError.set(false);
      this.state.set('open');
      return;
    }
    this.pinError.set(true);
  }

  async returnToFotobox(): Promise<void> {
    const config = savedStartConfig(this.settingsStore.settings());
    if (!config) {
      return;
    }
    this.state.set('starting');
    if (!(await this.fotoboxStart.start(config))) {
      this.state.set('locked');
    }
  }

  private async decide(): Promise<void> {
    await this.settingsSettled();

    const autoStartRoute =
      this.route.snapshot.data[AUTO_START_ROUTE_DATA] === true;
    // Claim only on the start route, so /settings never uses up auto-start.
    if (
      autoStartRoute &&
      this.access.claimAutoStart() &&
      this.access.autoStartEnabled()
    ) {
      const config = savedStartConfig(this.settingsStore.settings());
      if (config) {
        this.state.set('starting');
        if (await this.fotoboxStart.start(config)) {
          return;
        }
      }
    }

    this.state.set(this.access.isOpen() ? 'open' : 'locked');
  }

  /**
   * The settings may still be loading at app start, or the first load may
   * have failed while the API was coming up; load once more in that case.
   */
  private async settingsSettled(): Promise<void> {
    if (
      this.settingsStore.settings().length === 0 &&
      !this.settingsStore.isLoading()
    ) {
      this.settingsStore.loadSettings();
    }
    if (!this.settingsStore.isLoading()) {
      return;
    }
    await firstValueFrom(
      toObservable(this.settingsStore.isLoading, {
        injector: this.injector,
      }).pipe(filter((loading) => !loading)),
    );
  }
}
