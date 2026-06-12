import { Route } from '@angular/router';
import { SettingsComponent } from './settings/settings.component';
import { HomeComponent } from './home/home.component';
import { SingleLayoutComponent } from './layouts/single-layout/single-layout.component';
import { CollageLayoutComponent } from './layouts/collage-layout/collage-layout.component';
import { GalleryComponent } from './gallery/gallery.component';
import { DebugComponent } from './debug/debug.component';

export const appRoutes: Route[] = [
  { path: '', component: SettingsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'home', component: HomeComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'debug', component: DebugComponent },
  {
    path: 'layouts',
    children: [
      { path: 'single', component: SingleLayoutComponent },
      { path: 'collage', component: CollageLayoutComponent },
    ],
  },
];
