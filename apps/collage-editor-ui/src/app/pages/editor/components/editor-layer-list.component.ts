import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import type {
  EditorLayerInfo,
  LayerGroups,
} from '../../../services/fabric-canvas.service';

const TYPE_ICONS: Record<string, string> = {
  photo: 'crop_square',
  text: 'title',
  image: 'image',
  shape: 'category',
  background: 'palette',
};

/** Layers panel: background, decorations (re-orderable) and photo panes. */
@Component({
  selector: 'app-editor-layer-list',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-layer-list.component.html',
  styleUrl: './editor-layer-list.component.scss',
})
export class EditorLayerListComponent {
  readonly groups = input.required<LayerGroups>();
  readonly activeLayerId = input<string | null>(null);

  readonly layerSelect = output<string>();
  readonly toggleLocked = output<EditorLayerInfo>();
  readonly toggleVisible = output<EditorLayerInfo>();
  readonly duplicate = output<EditorLayerInfo>();
  readonly bringForward = output<string>();
  readonly sendBackward = output<string>();
  readonly remove = output<string>();
  readonly reorder = output<CdkDragDrop<EditorLayerInfo[]>>();

  typeIcon(type: string): string {
    return TYPE_ICONS[type] ?? 'layers';
  }
}
