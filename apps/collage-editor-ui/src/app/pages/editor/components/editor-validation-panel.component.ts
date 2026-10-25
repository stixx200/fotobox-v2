import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { ProjectValidationIssue } from '@fotobox/collage-editor/browser';
import { validationIssueText } from '../../../shared/validation-messages';

@Component({
  selector: 'app-editor-validation-panel',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="props validation" data-testid="validation-panel">
      <h3>
        {{ 'editor.validation' | translate }}
        @if (issues().length) {
          <span class="issue-count">{{ issues().length }}</span>
        }
      </h3>
      @if (!issues().length) {
        <p class="validation-ok">
          <mat-icon svgIcon="check_circle" />
          {{ 'editor.validationOk' | translate }}
        </p>
      } @else {
        <ul>
          @for (issue of issues(); track $index) {
            <li>
              @if (issue.layerId) {
                <button
                  type="button"
                  class="validation-issue"
                  [class.validation-issue--error]="issue.severity === 'error'"
                  [class.validation-issue--warning]="
                    issue.severity === 'warning'
                  "
                  [attr.title]="'editor.validationSelectLayer' | translate"
                  (click)="
                    layerSelect.emit({ layerId: issue.layerId!, event: $event })
                  "
                >
                  <mat-icon
                    [svgIcon]="issue.severity === 'error' ? 'error' : 'warning'"
                  />
                  <span>{{
                    text(issue).key | translate: text(issue).params
                  }}</span>
                </button>
                @if (issue.relatedLayerId) {
                  <button
                    type="button"
                    class="validation-related"
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
                <span
                  class="validation-issue"
                  [class.validation-issue--error]="issue.severity === 'error'"
                  [class.validation-issue--warning]="
                    issue.severity === 'warning'
                  "
                >
                  <mat-icon
                    [svgIcon]="issue.severity === 'error' ? 'error' : 'warning'"
                  />
                  <span>{{
                    text(issue).key | translate: text(issue).params
                  }}</span>
                </span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class EditorValidationPanelComponent {
  readonly issues = input.required<ProjectValidationIssue[]>();
  readonly layerSelect = output<{ layerId: string; event: Event }>();

  text(issue: ProjectValidationIssue) {
    return validationIssueText(issue);
  }
}
