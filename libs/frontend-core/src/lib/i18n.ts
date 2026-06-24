import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  provideTranslateService,
} from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { readStoredLanguage } from './api-config';

export interface FotoboxI18nOptions {
  fallbackLang?: string;
  loader?: {
    prefix?: string;
    suffix?: string;
  };
}

export function provideFotoboxI18n(
  options: FotoboxI18nOptions = {},
): EnvironmentProviders {
  const fallbackLang = options.fallbackLang ?? 'de';
  const loader = options.loader ?? {};
  return makeEnvironmentProviders([
    provideTranslateService({
      lang: readStoredLanguage(fallbackLang),
    }),
    provideTranslateHttpLoader({
      prefix: loader.prefix ?? './assets/i18n/',
      suffix: loader.suffix ?? '.json',
    }),
  ]);
}
