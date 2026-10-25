import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  // Both show the operator settings behind the optional operator PIN; only
  // the start route may auto-start straight into the guest flow.
  {
    path: '',
    data: { autoStart: true },
    loadComponent: () =>
      import('./operator-gate/operator-gate.component').then(
        (m) => m.OperatorGateComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./operator-gate/operator-gate.component').then(
        (m) => m.OperatorGateComponent,
      ),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./gallery/gallery.component').then((m) => m.GalleryComponent),
  },
  {
    path: 'debug',
    loadComponent: () =>
      import('./debug/debug.component').then((m) => m.DebugComponent),
  },
  {
    path: 'layouts',
    children: [
      {
        path: 'single',
        loadComponent: () =>
          import('./layouts/single-layout/single-layout.component').then(
            (m) => m.SingleLayoutComponent,
          ),
      },
      {
        path: 'collage',
        loadComponent: () =>
          import('./layouts/collage-layout/collage-layout.component').then(
            (m) => m.CollageLayoutComponent,
          ),
      },
    ],
  },
];
