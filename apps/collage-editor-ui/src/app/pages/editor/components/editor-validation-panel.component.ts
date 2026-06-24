import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ProjectValidationIssue } from '@fotobox/collage-editor/browser';

@Component({
  selector: 'app-editor-validation-panel',
  standalone: true,
  imports: [TranslatePipe],
  styleUrl: '../editor-panel.shared.scss',
  template: `
    @if (issues().length) {
      <div class="props validation">
        <h3>{{ 'editor.validation' | translate }}</h3>
        <ul>
          @for (issue of issues(); track issue.layerId ?? issue.message) {
            <li
              [class.error]="issue.severity === 'error'"
              [class.warning]="issue.severity === 'warning'"
            >
              @if (issue.layerId) {
                <button
                  type="button"
                  class="validation-issue"
                  [class.validation-issue--error]="issue.severity === 'error'"
                  [class.validation-issue--warning]="issue.severity === 'warning'"
                  [attr.title]="'editor.validationSelectLayer' | translate"
                  (click)="layerSelect.emit({ layerId: issue.layerId!, event: $event })"
                >
                  {{ issue.message }}
                </button>
                @if (issue.relatedLayerId) {
                  <button
                    type="button"
                    class="validation-issue validation-issue--related"
                    [attr.title]="'editor.validationSelectLayer' | translate"
                    (click)="
                      layerSelect.emit({
                        layerId: issue.relatedLayerId!,
                        event: $event,
                      })
                    "
                  >
                    {{ 'editor.validationSelectRelatedLayer' | translate }}
                  </button>
                }
              } @else {
                <span class="validation-issue-text">{{ issue.message }}</span>
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class EditorValidationPanelComponent {
  readonly issues = input.required<ProjectValidationIssue[]>();
  readonly layerSelect = output<{ layerId: string; event: Event }>();
}
