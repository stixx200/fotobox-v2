import { test, expect } from './support/fixtures';

test.describe('Fotobox UI smoke', () => {
  test('loads the settings page', async ({ page, graphql: _graphql }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start Fotobox' }),
    ).toBeVisible();
  });
});
