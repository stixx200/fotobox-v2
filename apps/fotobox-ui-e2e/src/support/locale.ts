import type { Page } from '@playwright/test';

export const LOCALE_STORAGE_KEY = 'fotobox.language';

/** Force English UI strings so e2e assertions stay stable across dev machines. */
export async function useEnglishLocale(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    localStorage.setItem(key, 'en');
  }, LOCALE_STORAGE_KEY);
}
