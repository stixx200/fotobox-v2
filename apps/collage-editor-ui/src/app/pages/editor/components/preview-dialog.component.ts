import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';

export type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; key: string; params?: Record<string, unknown> };

export interface PreviewDialogData {
  state: Signal<PreviewState>;
  retry: () => void;
}

/** Shows the server-rendered collage preview (with sample photos). */
@Component({
  selector: 'app-preview-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'editor.runtimePreview' | translate }}</h2>
    <mat-dialog-content>
      @switch (data.state().status) {
        @case ('loading') {
          <div class="placeholder" role="status">
            <mat-spinner diameter="40" />
            <p>{{ 'editor.previewRendering' | translate }}</p>
          </div>
        }
        @case ('ready') {
          <p class="hint">{{ 'editor.previewHint' | translate }}</p>
          <img
            class="preview-image"
            [src]="readyUrl()"
            [alt]="'editor.runtimePreview' | translate"
          />
        }
        @case ('error') {
          <div class="placeholder error" role="alert">
            <mat-icon svgIcon="error" />
            <p>{{ errorKey() | translate: errorParams() }}</p>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.state().status === 'error') {
        <button mat-button (click)="data.retry()">
          {{ 'common.retry' | translate }}
        </button>
      }
      <button mat-flat-button mat-dialog-close cdkFocusInitial>
        {{ 'common.close' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 240px;
      min-width: min(560px, 80vw);
      color: var(--mat-sys-on-surface-variant);
    }
    .placeholder.error {
      color: var(--mat-sys-error);
    }
    .hint {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .preview-image {
      display: block;
      max-width: 100%;
      max-height: 65vh;
      margin: 0 auto;
      border-radius: var(--mat-sys-corner-small);
      box-shadow: var(--mat-sys-level1);
    }
  `,
})
export class PreviewDialogComponent {
  readonly data = inject<PreviewDialogData>(MAT_DIALOG_DATA);

  readyUrl(): string {
    const state = this.data.state();
    return state.status === 'ready' ? state.url : '';
  }

  errorKey(): string {
    const state = this.data.state();
    return state.status === 'error' ? state.key : '';
  }

  errorParams(): Record<string, unknown> | undefined {
    const state = this.data.state();
    return state.status === 'error' ? state.params : undefined;
  }
}
