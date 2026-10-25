import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';

export interface ConfirmDialogData {
  /** Translation keys (+ params) for the dialog texts. */
  title: string;
  message: string;
  confirm: string;
  cancel?: string;
  params?: Record<string, unknown>;
  /** Styles the confirm button with the error color role. */
  destructive?: boolean;
  icon?: string;
}

/** M3 basic dialog for confirmations (replaces `window.confirm`). */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.icon) {
      <mat-icon class="dialog-icon" [svgIcon]="data.icon" aria-hidden="true" />
    }
    <h2 mat-dialog-title>{{ data.title | translate: data.params }}</h2>
    <mat-dialog-content>
      <p>{{ data.message | translate: data.params }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        [mat-dialog-close]="false"
        data-testid="confirm-cancel"
      >
        {{ data.cancel ?? 'common.cancel' | translate }}
      </button>
      <button
        mat-flat-button
        cdkFocusInitial
        [class.destructive]="data.destructive"
        [mat-dialog-close]="true"
        data-testid="confirm-accept"
      >
        {{ data.confirm | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
    .dialog-icon {
      display: block;
      margin: 24px auto 0;
      color: var(--mat-sys-secondary);
    }
    .dialog-icon + h2 {
      text-align: center;
    }
    p {
      margin: 0;
      max-width: 28rem;
    }
    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

export function openConfirmDialog(
  dialog: MatDialog,
  data: ConfirmDialogData,
): Observable<boolean> {
  return dialog
    .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data, autoFocus: 'dialog', restoreFocus: true, width: '420px' },
    )
    .afterClosed()
    .pipe(map((result) => result === true));
}
