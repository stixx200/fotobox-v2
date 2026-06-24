import { CanDeactivateFn } from '@angular/router';
import { EditorComponent } from '../pages/editor/editor.component';

export const unsavedChangesGuard: CanDeactivateFn<EditorComponent> = (
  component,
) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return window.confirm(
    component.translate('editor.unsavedConfirm'),
  );
};
