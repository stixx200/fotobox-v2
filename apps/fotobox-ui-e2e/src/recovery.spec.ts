import { test, expect } from './support/fixtures';
import {
  photoView,
  pressShutter,
  startBooth,
  takeSinglePhoto,
} from './support/booth';

test.describe('API unreachable', () => {
  test('waits on the splash screen until the API is up', async ({
    page,
    graphql,
  }) => {
    graphql.setOffline(true);
    await page.goto('/');
    await expect(
      page.getByText('Connecting to the photo booth…'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeHidden();

    graphql.setOffline(false);
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
  });

  test('gives up after a while and "Retry" reconnects', async ({
    page,
    graphql,
  }) => {
    await page.clock.install();
    graphql.setOffline(true);
    await page.goto('/');

    // The health check retries every second for about 30 seconds.
    const noConnection = page.getByRole('heading', { name: 'No connection' });
    await expect(async () => {
      await page.clock.fastForward(1000);
      await expect(noConnection).toBeVisible({ timeout: 100 });
    }).toPass({ timeout: 30_000 });
    await expect(
      page.getByText('The photo booth software is not responding.'),
    ).toBeVisible();

    graphql.setOffline(false);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
  });
});

test.describe('Connection lost in the guest flow', () => {
  test('shows the offline banner and recovers once the API is back', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ shutterTimeout: 0 });
    await startBooth(page);
    await expect(page).toHaveURL(/\/layouts\/single/);

    const banner = page.getByRole('alert').filter({
      hasText:
        'Connection to the photo booth lost – reconnecting automatically.',
    });
    await expect(banner).toBeHidden();

    graphql.setOffline(true);
    await pressShutter(page);
    await expect(banner).toBeVisible();
    await expect(photoView(page)).toBeHidden();
    await expect(page.getByTestId('shutter')).toBeVisible();

    // The subscription socket reconnects and the banner goes away.
    graphql.setOffline(false);
    await expect(banner).toBeHidden({ timeout: 20_000 });
    await takeSinglePhoto(page);
  });

  test('the offline banner can be dismissed', async ({ page, graphql }) => {
    graphql.setSettings({ shutterTimeout: 0 });
    await startBooth(page);
    await expect(page.getByTestId('shutter')).toBeVisible();

    graphql.setOffline(true);
    await pressShutter(page);
    const banner = page.getByRole('alert').filter({
      hasText: 'Connection to the photo booth lost',
    });
    await expect(banner).toBeVisible();

    await banner.getByRole('button', { name: 'Dismiss' }).click();
    await expect(banner).toBeHidden();
  });
});
