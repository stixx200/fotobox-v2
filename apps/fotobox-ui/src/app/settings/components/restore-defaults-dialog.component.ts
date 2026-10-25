import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** Confirms resetting all settings to their defaults; closes with `true`. */
@Component({
  selector: 'app-restore-defaults-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon class="restore-dialog__icon" aria-hidden="true"
      >settings_backup_restore</mat-icon
    >
    <h2 mat-dialog-title>
      {{ 'SETTINGS.RESTORE_DEFAULTS_TITLE' | translate }}
    </h2>
    <mat-dialog-content>
      <p>{{ 'SETTINGS.RESTORE_DEFAULTS_TEXT' | translate }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">
        {{ 'SETTINGS.RESTORE_DEFAULTS_CANCEL' | translate }}
      </button>
      <button
        matButton="filled"
        type="button"
        class="restore-dialog__confirm"
        [mat-dialog-close]="true"
      >
        {{ 'SETTINGS.RESTORE_DEFAULTS_CONFIRM' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    .restore-dialog__icon {
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
      margin: 0;
    }

    .restore-dialog__confirm {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class RestoreDefaultsDialogComponent {}
