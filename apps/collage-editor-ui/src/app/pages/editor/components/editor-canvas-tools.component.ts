import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-editor-canvas-tools',
  standalone: true,
  imports: [MatSlideToggleModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="props">
      <h3>{{ 'editor.canvasTools' | translate }}</h3>
      <div class="toggle-list">
        <mat-slide-toggle
          hideIcon
          [checked]="snapEnabled()"
          (change)="snapChange.emit($event.checked)"
        >
          {{ 'editor.snap' | translate }}
        </mat-slide-toggle>
        <mat-slide-toggle
          hideIcon
          [checked]="magneticGuidesEnabled()"
          (change)="magneticGuidesChange.emit($event.checked)"
        >
          {{ 'editor.magneticGuides' | translate }}
        </mat-slide-toggle>
        <mat-slide-toggle
          hideIcon
          [checked]="showGrid()"
          (change)="showGridChange.emit($event.checked)"
        >
          {{ 'editor.grid' | translate }}
        </mat-slide-toggle>
        <mat-slide-toggle
          hideIcon
          [checked]="showGuides()"
          (change)="showGuidesChange.emit($event.checked)"
        >
          {{ 'editor.guides' | translate }}
        </mat-slide-toggle>
        <mat-slide-toggle
          hideIcon
          [checked]="showSafeArea()"
          (change)="showSafeAreaChange.emit($event.checked)"
        >
          {{ 'editor.safeArea' | translate }}
        </mat-slide-toggle>
      </div>
    </div>
  `,
})
export class EditorCanvasToolsComponent {
  readonly magneticGuidesEnabled = input.required<boolean>();
  readonly snapEnabled = input.required<boolean>();
  readonly showGrid = input.required<boolean>();
  readonly showGuides = input.required<boolean>();
  readonly showSafeArea = input.required<boolean>();

  readonly magneticGuidesChange = output<boolean>();
  readonly snapChange = output<boolean>();
  readonly showGridChange = output<boolean>();
  readonly showGuidesChange = output<boolean>();
  readonly showSafeAreaChange = output<boolean>();
}
