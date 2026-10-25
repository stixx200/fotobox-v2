import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { isValidTemplateId } from '../../../shared/template-id';

@Component({
  selector: 'app-editor-project-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="project-settings dense-fields">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editor.projectName' | translate }}</mat-label>
        <input
          matInput
          name="templateName"
          [ngModel]="templateName()"
          (ngModelChange)="templateNameChange.emit($event)"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editor.projectId' | translate }}</mat-label>
        <input
          matInput
          name="templateId"
          spellcheck="false"
          autocomplete="off"
          [ngModel]="templateId()"
          (ngModelChange)="templateIdChange.emit($event)"
        />
        @if (idInvalid()) {
          <mat-hint class="field-error">{{
            'editor.projectIdInvalid' | translate
          }}</mat-hint>
        } @else {
          <mat-hint>{{ 'editor.projectIdHint' | translate }}</mat-hint>
        }
      </mat-form-field>
      <div class="field-grid">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'editor.projectWidth' | translate }}</mat-label>
          <input
            matInput
            type="number"
            min="1"
            name="canvasWidth"
            [ngModel]="canvasWidth()"
            (ngModelChange)="canvasWidthChange.emit(+$event)"
            (change)="resizeCanvas.emit()"
          />
          <span matTextSuffix>px</span>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'editor.projectHeight' | translate }}</mat-label>
          <input
            matInput
            type="number"
            min="1"
            name="canvasHeight"
            [ngModel]="canvasHeight()"
            (ngModelChange)="canvasHeightChange.emit(+$event)"
            (change)="resizeCanvas.emit()"
          />
          <span matTextSuffix>px</span>
        </mat-form-field>
      </div>
      <p class="hint">{{ 'editor.projectSizeHint' | translate }}</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'editor.projectDirectory' | translate }}</mat-label>
        <input
          matInput
          name="collageDirectory"
          spellcheck="false"
          autocomplete="off"
          [ngModel]="collageDirectory()"
          (ngModelChange)="collageDirectoryChange.emit($event)"
        />
        <mat-hint>{{ 'editor.projectDirectoryHint' | translate }}</mat-hint>
      </mat-form-field>
      <div class="template-border">
        <mat-slide-toggle
          hideIcon
          [checked]="templateBorderEnabled()"
          (change)="templateBorderEnabledChange.emit($event.checked)"
        >
          {{ 'editor.templateBorder' | translate }}
        </mat-slide-toggle>
        @if (templateBorderEnabled()) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'editor.borderWidth' | translate }}</mat-label>
            <input
              matInput
              type="number"
              min="0"
              name="templateBorderWidth"
              [ngModel]="templateBorderWidth()"
              (ngModelChange)="templateBorderWidthChange.emit(+$event)"
              (change)="applyTemplateBorder.emit()"
            />
            <span matTextSuffix>px</span>
          </mat-form-field>
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

  idInvalid(): boolean {
    return !isValidTemplateId(this.templateId());
  }
}
