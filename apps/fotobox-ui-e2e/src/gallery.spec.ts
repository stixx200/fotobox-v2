import { test, expect } from './support/fixtures';

test.describe('Gallery PIN', () => {
  test('unlocks with the on-screen keypad', async ({ page, graphql }) => {
    graphql.setSettings({ showGalleryButton: true, galleryPassword: '1234' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Fotobox' }).click();

    await page.getByRole('button', { name: 'Open gallery' }).click();
    await expect(
      page.getByRole('heading', { name: 'Enter gallery PIN' }),
    ).toBeVisible();

    for (const digit of '1111') {
      await page.locator(`[data-key="${digit}"]`).click();
    }
    await expect(page.getByText('Wrong PIN – please try again')).toBeVisible();

    for (const digit of '1234') {
      await page.locator(`[data-key="${digit}"]`).click();
    }
    await expect(
      page.getByRole('heading', { name: 'No photos yet' }),
    ).toBeVisible();
  });
});
