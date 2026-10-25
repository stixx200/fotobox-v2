import { test, expect } from './support/fixtures';
import {
  photoView,
  snackbar,
  startBooth,
  takeSinglePhoto,
} from './support/booth';

test.describe('Print', () => {
  test.beforeEach(({ graphql }) => {
    graphql.setSettings({ shutterTimeout: 0 });
  });

  test('prints the photo on the configured printer', async ({
    page,
    graphql,
  }) => {
    await startBooth(page);
    await takeSinglePhoto(page);

    await page.getByTestId('photo-print').click();
    await expect(
      snackbar(page, 'Your photo is printing – just a moment.'),
    ).toBeVisible();
    expect(graphql.callsTo('PrintPhoto')).toEqual([
      {
        input: {
          filename: 'photo-1.jpg',
          printerName: 'printer1',
          landscape: true,
        },
      },
    ]);
    // Printed: the booth is ready for the next guest.
    await expect(photoView(page)).toBeHidden();
    await expect(page.getByTestId('shutter')).toBeVisible();
  });

  test('a print failure keeps the photo and asks for help', async ({
    page,
    graphql,
  }) => {
    graphql.handle('PrintPhoto', () => ({
      data: { printPhoto: { success: false, message: 'Out of paper' } },
    }));
    await startBooth(page);
    await takeSinglePhoto(page);

    await page.getByTestId('photo-print').click();
    await expect(
      snackbar(
        page,
        'Printing did not work. Please ask the photo booth team to check printer and paper.',
      ),
    ).toBeVisible();
    await expect(photoView(page)).toBeVisible();
    await expect(page.getByTestId('photo-print')).toBeEnabled();
  });

  test('the print button is hidden when the printer is disabled', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ usePrinter: false });
    await startBooth(page);
    await takeSinglePhoto(page);

    await expect(page.getByTestId('photo-print')).toHaveCount(0);
  });
});

test.describe('Share', () => {
  test.beforeEach(({ graphql }) => {
    graphql.setSettings({ shutterTimeout: 0, useShare: true });
  });

  test('shows a QR code for the photo', async ({ page, graphql }) => {
    await startBooth(page);
    await takeSinglePhoto(page);

    await page.getByTestId('photo-share').click();
    const overlay = page.getByRole('dialog', { name: 'Share photo' });
    await expect(overlay).toBeVisible();
    await expect(
      overlay.getByRole('img', { name: 'QR code for photo download' }),
    ).toBeVisible();
    await expect(overlay).toContainText('Link valid until');
    expect(graphql.callsTo('CreateShareLink')).toEqual([
      { filename: 'photo-1.jpg' },
    ]);

    await overlay.getByRole('button', { name: 'Done' }).click();
    await expect(overlay).toBeHidden();
    await expect(photoView(page)).toBeVisible();
  });

  test('a share failure shows a friendly error', async ({ page, graphql }) => {
    graphql.fail('CreateShareLink');
    await startBooth(page);
    await takeSinglePhoto(page);

    await page.getByTestId('photo-share').click();
    await expect(
      snackbar(
        page,
        'The QR code could not be created right now. Please try again.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Share photo' }),
    ).toBeHidden();
    await expect(page.getByTestId('photo-share')).toBeEnabled();
  });
});
