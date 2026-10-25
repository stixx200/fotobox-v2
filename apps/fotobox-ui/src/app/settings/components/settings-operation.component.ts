import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { KioskHostService } from '../../services/kiosk-host.service';
import { NotificationService } from '../../services/notification.service';
import { ClientLogService } from '../../services/client-log.service';
import { PIN_LENGTH } from '../../services/pin.util';
import { ExitKioskDialogComponent } from './exit-kiosk-dialog.component';

/** "Betrieb" card: operator PIN, auto-start and leaving the kiosk. */
@Component({
  selector: 'app-settings-operation',
  standalone: true,
  styleUrl: '../settings-panel.shared.scss',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="settings-card" [formGroup]="settingsForm()">
      <div class="card-header">
        <mat-icon>admin_panel_settings</mat-icon>
        <span>{{ 'SETTINGS.OPERATION' | translate }}</span>
      </div>
      <div class="card-body">
        <mat-form-field floatLabel="always">
          <mat-label>{{ 'SETTINGS.OPERATOR_PIN' | translate }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="operatorPin"
            [attr.maxlength]="pinLength"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            class="operator-pin-input"
            (input)="operatorPinInput.emit($event)"
          />
          <mat-hint>{{ 'SETTINGS.OPERATOR_PIN_HINT' | translate }}</mat-hint>
          @if (
            settingsForm().controls['operatorPin'].touched &&
            settingsForm().controls['operatorPin'].hasError('operatorPin')
          ) {
            <mat-error>{{
              'SETTINGS.OPERATOR_PIN_INVALID' | translate
            }}</mat-error>
          }
        </mat-form-field>

        <mat-checkbox formControlName="autoStart">{{
          'SETTINGS.AUTO_START' | translate
        }}</mat-checkbox>
        <p class="settings-field-hint settings-field-hint--inline">
          {{ 'SETTINGS.AUTO_START_HINT' | translate }}
        </p>

        @if (showExitToWindows) {
          <div class="exit-kiosk-action">
            <button
              matButton="outlined"
              type="button"
              class="exit-kiosk-button"
              [disabled]="exiting()"
              (click)="exitToWindows()"
            >
              @if (exiting()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-icon>logout</mat-icon>
              }
              {{ 'SETTINGS.EXIT_TO_WINDOWS' | translate }}
            </button>
            <p class="settings-field-hint">
              {{ 'SETTINGS.EXIT_TO_WINDOWS_HINT' | translate }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class SettingsOperationComponent {
  private readonly host = inject(KioskHostService);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly clientLog = inject(ClientLogService);

  readonly settingsForm = input.required<FormGroup>();
  readonly operatorPinInput = output<Event>();

  readonly pinLength = PIN_LENGTH;
  /** Leaving the kiosk is only possible in the desktop app. */
  readonly showExitToWindows = this.host.isDesktopHost();
  readonly exiting = signal(false);

  async exitToWindows(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<
          ExitKioskDialogComponent,
          void,
          boolean
        >(ExitKioskDialogComponent, { maxWidth: '32rem', autoFocus: 'first-tabbable' })
        .afterClosed(),
    );
    if (confirmed !== true) {
      return;
    }

    this.exiting.set(true);
    try {
      if (!(await this.host.exitToWindows())) {
        throw new Error('Not running in the desktop app');
      }
    } catch (error) {
      this.clientLog.error('Exit to Windows failed', error);
      this.notification.error(
        this.translate.instant('SETTINGS.EXIT_TO_WINDOWS_ERROR'),
      );
    } finally {
      this.exiting.set(false);
    }
  }
}
