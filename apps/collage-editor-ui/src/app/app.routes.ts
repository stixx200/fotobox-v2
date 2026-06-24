import { Route } from '@angular/router';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/project-list/project-list.component').then(
        (m) => m.ProjectListComponent,
      ),
  },
  {
    path: 'editor',
    loadComponent: () =>
      import('./pages/editor/editor.component').then((m) => m.EditorComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'editor/:templateId',
    loadComponent: () =>
      import('./pages/editor/editor.component').then((m) => m.EditorComponent),
    canDeactivate: [unsavedChangesGuard],
  },
];
