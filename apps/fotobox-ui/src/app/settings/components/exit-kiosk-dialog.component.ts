import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** Confirms leaving the kiosk for Windows; closes with `true` to proceed. */
@Component({
  selector: 'app-exit-kiosk-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon class="exit-dialog__icon" aria-hidden="true">logout</mat-icon>
    <h2 mat-dialog-title>{{ 'EXIT_KIOSK.TITLE' | translate }}</h2>
    <mat-dialog-content>
      <p>{{ 'EXIT_KIOSK.MAINTENANCE' | translate }}</p>
      <p class="exit-dialog__steps-title">
        {{ 'EXIT_KIOSK.STEPS_TITLE' | translate }}
      </p>
      <ol class="exit-dialog__steps">
        <li>{{ 'EXIT_KIOSK.STEP_KEYS' | translate }}</li>
        <li>{{ 'EXIT_KIOSK.STEP_SWITCH_USER' | translate }}</li>
        <li>{{ 'EXIT_KIOSK.STEP_SIGN_IN' | translate }}</li>
      </ol>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">
        {{ 'EXIT_KIOSK.CANCEL' | translate }}
      </button>
      <button
        matButton="filled"
        type="button"
        class="exit-dialog__confirm"
        [mat-dialog-close]="true"
      >
        {{ 'EXIT_KIOSK.CONFIRM' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    .exit-dialog__icon {
      display: block;
      margin: 24px auto 0;
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: var(--mat-sys-secondary);
    }

    h2 {
      text-align: center;
    }

    p {
      margin: 0 0 12px;
    }

    .exit-dialog__steps-title {
      margin-bottom: 4px;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }

    .exit-dialog__steps {
      margin: 0;
      padding-inline-start: 1.5rem;

      li {
        padding: 2px 0;
      }
    }
  `,
})
export class ExitKioskDialogComponent {}
