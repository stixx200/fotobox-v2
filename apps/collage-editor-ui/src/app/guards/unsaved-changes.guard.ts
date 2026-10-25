import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { EditorComponent } from '../pages/editor/editor.component';
import { openConfirmDialog } from '../shared/confirm-dialog.component';

export const unsavedChangesGuard: CanDeactivateFn<EditorComponent> = (
  component,
) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return openConfirmDialog(inject(MatDialog), {
    title: 'editor.unsavedTitle',
    message: 'editor.unsavedConfirm',
    confirm: 'editor.discardChanges',
    cancel: 'editor.keepEditing',
    destructive: true,
    icon: 'warning',
  });
};
