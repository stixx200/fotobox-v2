import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Open the settings and press "Start Fotobox" (no operator PIN set). */
export async function startBooth(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Fotobox' }).click();
}

/** Tap the shutter button of the current layout. */
export async function pressShutter(page: Page): Promise<void> {
  await page.getByTestId('shutter').click();
}

/** The full-screen view of a captured photo or finished collage. */
export function photoView(page: Page) {
  return page.getByRole('dialog', { name: 'Captured photo' });
}

/** Take a photo in the single layout and wait until it is shown. */
export async function takeSinglePhoto(page: Page): Promise<void> {
  await pressShutter(page);
  await expect(photoView(page)).toBeVisible();
}

/** A snackbar message (success or error). */
export function snackbar(page: Page, text: string) {
  return page.locator('mat-snack-bar-container').getByText(text);
}
