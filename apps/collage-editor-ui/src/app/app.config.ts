import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { provideFotoboxI18n } from '@fotobox/frontend-core';
import { appRoutes } from './app.routes';
import { createApolloOptions } from './graphql.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withXhr()),
    provideApollo(createApolloOptions),
    provideFotoboxI18n(),
  ],
};
