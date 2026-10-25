import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.locator(`app-pin-pad [data-key="${digit}"]`).click();
  }
}

async function tapEscapeZone(page: Page): Promise<void> {
  const zone = page.locator('.escape-zone');
  for (let i = 0; i < 5; i++) {
    await zone.click();
  }
}

test.describe('Operator access', () => {
  test('escape zone asks for the operator PIN before showing settings', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ operatorPin: '4711' });
    await page.goto('/');

    // The start route is protected as well; unlock, then start the booth.
    const pinHeading = page.getByRole('heading', {
      name: 'Enter operator PIN',
    });
    await expect(pinHeading).toBeVisible();
    await enterPin(page, '4711');
    await page.getByRole('button', { name: 'Start Fotobox' }).click();
    await expect(page).toHaveURL(/\/layouts\/single/);

    // Back to the settings through the hidden corner: locked again.
    await tapEscapeZone(page);
    await expect(page).toHaveURL(/\/settings/);
    await expect(pinHeading).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeHidden();

    await enterPin(page, '1234');
    await expect(page.getByText('Wrong PIN – please try again')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeHidden();

    await enterPin(page, '4711');
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
  });

  test('the PIN pad leads back to the guest flow', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ operatorPin: '4711' });
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'Enter operator PIN' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Back to the Fotobox' }).click();
    await expect(page).toHaveURL(/\/layouts\/single/);
  });

  test('auto-start skips the settings on launch', async ({ page, graphql }) => {
    graphql.setSettings({ autoStart: true, operatorPin: '4711' });
    await page.goto('/');

    await expect(page).toHaveURL(/\/layouts\/single/);
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Enter operator PIN' }),
    ).toBeHidden();
  });

  test('an explicit visit to /settings never auto-starts', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ autoStart: true });
    await page.goto('/settings');

    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/settings/);
  });
});
