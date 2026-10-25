import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideApollo } from 'apollo-angular';
import { provideFotoboxI18n } from '@fotobox/frontend-core';
import { appRoutes } from './app.routes';
import { createApolloOptions } from './graphql.config';
import { provideAppIcons } from './icons';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withXhr()),
    provideApollo(createApolloOptions),
    provideFotoboxI18n(),
    provideAppIcons(),
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { duration: 4000, verticalPosition: 'bottom' },
    },
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 400, hideDelay: 0, touchendHideDelay: 1000 },
    },
  ],
};
