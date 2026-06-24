import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
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
