import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

interface ShortcutRow {
  keys: string[];
  label: string;
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Keyboard shortcut reference (opened from the top bar or with `?`). */
@Component({
  selector: 'app-shortcuts-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'editor.shortcutsTitle' | translate }}</h2>
    <mat-dialog-content>
      <dl class="shortcuts">
        @for (row of rows; track row.label) {
          <div class="row">
            <dt>
              @for (key of row.keys; track $index) {
                @if (!$first) {
                  <span class="plus">+</span>
                }
                <kbd>{{ key | translate }}</kbd>
              }
            </dt>
            <dd>{{ row.label | translate }}</dd>
          </div>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close cdkFocusInitial>
        {{ 'common.close' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .shortcuts {
      margin: 0;
      display: grid;
      gap: 6px;
      min-width: min(420px, 80vw);
    }
    .row {
      display: grid;
      grid-template-columns: 11rem 1fr;
      align-items: center;
      gap: 12px;
    }
    dt {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    dd {
      margin: 0;
      color: var(--mat-sys-on-surface);
    }
    .plus {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ShortcutsDialogComponent {
  private readonly mod = IS_MAC ? '⌘' : 'editor.keys.ctrl';

  readonly rows: ShortcutRow[] = [
    { keys: [this.mod, 'S'], label: 'editor.shortcutSave' },
    { keys: [this.mod, 'Z'], label: 'editor.shortcutUndo' },
    {
      keys: [this.mod, 'editor.keys.shift', 'Z'],
      label: 'editor.shortcutRedo',
    },
    { keys: [this.mod, 'D'], label: 'editor.shortcutDuplicate' },
    { keys: ['editor.keys.delete'], label: 'editor.shortcutDelete' },
    { keys: ['←↑→↓'], label: 'editor.shortcutNudge' },
    {
      keys: ['editor.keys.shift', '←↑→↓'],
      label: 'editor.shortcutNudgeLarge',
    },
    { keys: ['editor.keys.esc'], label: 'editor.shortcutDeselect' },
    {
      keys: [IS_MAC ? '⌥' : 'Alt', 'editor.keys.wheel'],
      label: 'editor.shortcutZoom',
    },
    {
      keys: ['editor.keys.shift', 'editor.keys.drag'],
      label: 'editor.shortcutPan',
    },
    { keys: ['?'], label: 'editor.shortcutHelp' },
  ];
}
