import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-editor-canvas-tools',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  styleUrl: '../editor-panel.shared.scss',
  template: `
    <div class="props">
      <h3>{{ 'editor.canvasTools' | translate }}</h3>
      <div class="toggle-grid">
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="magneticGuidesEnabled()"
            (ngModelChange)="magneticGuidesChange.emit($event)"
          />
          {{ 'editor.magneticGuides' | translate }}
        </label>
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="snapEnabled()"
            (ngModelChange)="snapChange.emit($event)"
          />
          {{ 'editor.snap' | translate }}
        </label>
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="showGrid()"
            (ngModelChange)="showGridChange.emit($event)"
          />
          {{ 'editor.grid' | translate }}
        </label>
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="showGuides()"
            (ngModelChange)="showGuidesChange.emit($event)"
          />
          {{ 'editor.guides' | translate }}
        </label>
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="showSafeArea()"
            (ngModelChange)="showSafeAreaChange.emit($event)"
          />
          {{ 'editor.safeArea' | translate }}
        </label>
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
