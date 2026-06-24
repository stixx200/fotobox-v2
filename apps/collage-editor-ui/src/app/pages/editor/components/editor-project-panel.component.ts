import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-editor-project-panel',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  styleUrl: '../editor-panel.shared.scss',
  template: `
    <div class="project-settings">
      <label>
        <span>{{ 'editor.projectId' | translate }}</span>
        <input
          [ngModel]="templateId()"
          (ngModelChange)="templateIdChange.emit($event)"
        />
      </label>
      <label>
        <span>{{ 'editor.projectName' | translate }}</span>
        <input
          [ngModel]="templateName()"
          (ngModelChange)="templateNameChange.emit($event)"
        />
      </label>
      <div class="field-grid">
        <label>
          <span>{{ 'editor.projectWidth' | translate }}</span>
          <input
            type="number"
            min="1"
            [ngModel]="canvasWidth()"
            (ngModelChange)="canvasWidthChange.emit(+$event)"
            (change)="resizeCanvas.emit()"
          />
        </label>
        <label>
          <span>{{ 'editor.projectHeight' | translate }}</span>
          <input
            type="number"
            min="1"
            [ngModel]="canvasHeight()"
            (ngModelChange)="canvasHeightChange.emit(+$event)"
            (change)="resizeCanvas.emit()"
          />
        </label>
      </div>
      <label>
        <span>{{ 'editor.projectDirectory' | translate }}</span>
        <input
          [ngModel]="collageDirectory()"
          (ngModelChange)="collageDirectoryChange.emit($event)"
        />
      </label>
      <div class="template-border">
        <label class="checkbox-row">
          <input
            type="checkbox"
            [ngModel]="templateBorderEnabled()"
            (ngModelChange)="templateBorderEnabledChange.emit($event)"
          />
          <span>{{ 'editor.templateBorder' | translate }}</span>
        </label>
        @if (templateBorderEnabled()) {
          <label>
            <span>{{ 'editor.borderWidth' | translate }}</span>
            <input
              type="number"
              min="0"
              [ngModel]="templateBorderWidth()"
              (ngModelChange)="templateBorderWidthChange.emit(+$event)"
              (change)="applyTemplateBorder.emit()"
            />
          </label>
        }
      </div>
    </div>
  `,
})
export class EditorProjectPanelComponent {
  readonly templateId = input.required<string>();
  readonly templateName = input.required<string>();
  readonly canvasWidth = input.required<number>();
  readonly canvasHeight = input.required<number>();
  readonly collageDirectory = input.required<string>();
  readonly templateBorderEnabled = input.required<boolean>();
  readonly templateBorderWidth = input.required<number>();

  readonly templateIdChange = output<string>();
  readonly templateNameChange = output<string>();
  readonly canvasWidthChange = output<number>();
  readonly canvasHeightChange = output<number>();
  readonly collageDirectoryChange = output<string>();
  readonly templateBorderEnabledChange = output<boolean>();
  readonly templateBorderWidthChange = output<number>();
  readonly resizeCanvas = output<void>();
  readonly applyTemplateBorder = output<void>();
}
