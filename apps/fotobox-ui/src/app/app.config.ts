import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideFotoboxI18n } from '@fotobox/frontend-core';
import { appRoutes } from './app.routes';
import { createApolloOptions } from './graphql.config';
import { GlobalErrorHandler } from './services/global-error.handler';
import { ClientLogService } from './services/client-log.service';
import { RecoveryService } from './services/recovery.service';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { floatLabel: 'always' },
    },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideApollo(() =>
      createApolloOptions(inject(ClientLogService), inject(RecoveryService)),
    ),
    provideFotoboxI18n(),
  ],
};
