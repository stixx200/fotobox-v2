import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import type { DecorationPresetId } from '../../../services/fabric-decorations';

export type ShapeKind = 'rect' | 'ellipse' | 'circle' | 'roundedRect' | 'line';
export type SaveState = 'new' | 'dirty' | 'saving' | 'saved';

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: 'editor.shape' },
  { kind: 'roundedRect', label: 'editor.roundedRect' },
  { kind: 'ellipse', label: 'editor.ellipse' },
  { kind: 'circle', label: 'editor.circle' },
  { kind: 'line', label: 'editor.line' },
];

const PRESETS: { id: DecorationPresetId; label: string }[] = [
  { id: 'confetti', label: 'editor.presetsConfetti' },
  { id: 'hearts', label: 'editor.presetsHearts' },
  { id: 'sparkles', label: 'editor.presetsSparkles' },
  { id: 'petals', label: 'editor.presetsPetals' },
  { id: 'balloons', label: 'editor.presetsBalloons' },
  { id: 'bubbles', label: 'editor.presetsBubbles' },
  { id: 'bokeh', label: 'editor.presetsBokeh' },
];

/** Max. size of an image added to the template (decoded in the browser). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * M3 top app bar of the editor: navigation + document state on the left,
 * insert tools in the centre, preview/help/save on the right.
 */
@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  readonly templateName = input.required<string>();
  readonly saveState = input.required<SaveState>();
  readonly photoCount = input.required<number>();
  readonly canUndo = input.required<boolean>();
  readonly canRedo = input.required<boolean>();
  readonly previewPinned = input.required<boolean>();

  readonly back = output<void>();
  readonly undo = output<void>();
  readonly redo = output<void>();
  readonly addPhotoPane = output<void>();
  readonly addText = output<void>();
  readonly addShape = output<ShapeKind>();
  readonly addDecoration = output<DecorationPresetId>();
  readonly imageSelected = output<File>();
  readonly preview = output<void>();
  readonly previewPinnedChange = output<boolean>();
  readonly save = output<{ close: boolean }>();
  readonly shortcuts = output<void>();
  readonly editProject = output<void>();

  readonly shapes = SHAPES;
  readonly presets = PRESETS;

  onImageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.imageSelected.emit(file);
    }
  }
}
