import { test, expect } from './support/fixtures';
import {
  photoView,
  pressShutter,
  snackbar,
  startBooth,
  takeSinglePhoto,
} from './support/booth';

test.describe('Guest flow: single photo', () => {
  test('counts down, shows the photo and returns to the live view', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ shutterTimeout: 1 });
    await startBooth(page);
    await expect(page).toHaveURL(/\/layouts\/single/);
    await expect(
      page.getByText('Touch the screen to take a photo'),
    ).toBeVisible();

    await pressShutter(page);
    const countdown = page.locator('.countdown-number');
    await expect(countdown).toHaveText('1');
    await expect(countdown).toHaveText(/Smile!/);

    await expect(photoView(page)).toBeVisible();
    await expect(photoView(page).getByRole('img')).toHaveAttribute(
      'src',
      /\/api\/photos\/photo-1\.jpg$/,
    );
    expect(graphql.callsTo('TakePicture')).toHaveLength(1);

    // Only one layout active: "New photo" goes straight back to the camera.
    await page.getByRole('button', { name: 'New photo' }).click();
    await expect(photoView(page)).toBeHidden();
    await expect(page.getByTestId('shutter')).toBeVisible();
    await expect(page).toHaveURL(/\/layouts\/single/);
  });

  test('from the layout choice and back home', async ({ page, graphql }) => {
    graphql.setSettings({
      shutterTimeout: 0,
      layouts: ['Einzelbild', 'Collage'],
    });
    await startBooth(page);
    await expect(page).toHaveURL(/\/home/);
    await expect(
      page.getByRole('heading', { name: 'Choose a layout' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Single photo/ }).click();
    await expect(page).toHaveURL(/\/layouts\/single/);

    await takeSinglePhoto(page);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(
      page.getByRole('heading', { name: 'Choose a layout' }),
    ).toBeVisible();
  });

  test('a camera error tells the guest and allows another try', async ({
    page,
    graphql,
  }) => {
    graphql.setSettings({ shutterTimeout: 0 });
    graphql.fail('TakePicture', 'Camera disconnected');
    await startBooth(page);

    await pressShutter(page);
    await expect(
      snackbar(page, 'The photo could not be taken. Please try again.'),
    ).toBeVisible();
    // The technical cause is never shown to guests.
    await expect(page.getByText('Camera disconnected')).toBeHidden();
    await expect(photoView(page)).toBeHidden();
    await expect(page.getByTestId('shutter')).toBeVisible();

    graphql.restore('TakePicture');
    await takeSinglePhoto(page);
  });
});

test.describe('Guest flow: collage', () => {
  test.beforeEach(({ graphql }) => {
    graphql.setSettings({
      shutterTimeout: 0,
      layouts: ['Einzelbild', 'Collage'],
    });
  });

  async function openCollage(page: import('@playwright/test').Page) {
    await startBooth(page);
    await page.getByRole('button', { name: /Collage/ }).click();
    await expect(page).toHaveURL(/\/layouts\/collage\?template=Collage/);
  }

  async function shootAndAccept(
    page: import('@playwright/test').Page,
    step: string,
  ) {
    await expect(page.getByText(step).first()).toBeVisible();
    await pressShutter(page);
    const review = page.getByRole('dialog', { name: 'Use this photo?' });
    await expect(review).toBeVisible();
    await review.getByRole('button', { name: 'Use it' }).click();
    await expect(review).toBeHidden();
  }

  test('takes all photos, shows the collage and returns home', async ({
    page,
    graphql,
  }) => {
    await openCollage(page);
    await expect
      .poll(() => graphql.callsTo('StartCollage'))
      .toEqual([{ input: { templateId: 'Collage' } }]);

    await shootAndAccept(page, 'Photo 1 of 2');
    // A retake does not add the photo to the collage.
    await expect(page.getByText('Photo 2 of 2').first()).toBeVisible();
    await pressShutter(page);
    const review = page.getByRole('dialog', { name: 'Use this photo?' });
    await review.getByRole('button', { name: 'Retake' }).click();
    await shootAndAccept(page, 'Photo 2 of 2');

    await expect(photoView(page)).toBeVisible();
    await expect(photoView(page).getByRole('img')).toHaveAttribute(
      'src',
      /\/api\/photos\/collage-1\.jpg$/,
    );
    expect(graphql.callsTo('AddPhotoToCollage')).toEqual([
      { input: { photoPath: 'photo-1.jpg' } },
      { input: { photoPath: 'photo-3.jpg' } },
    ]);
    expect(graphql.callsTo('FinalizeCollage')).toHaveLength(1);

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect.poll(() => graphql.callsTo('ResetCollage').length).toBe(1);
  });

  test('a failed collage can be created again', async ({ page, graphql }) => {
    graphql.fail('FinalizeCollage', 'Template file missing');
    await openCollage(page);
    await shootAndAccept(page, 'Photo 1 of 2');
    await shootAndAccept(page, 'Photo 2 of 2');

    const error = page.getByRole('alertdialog', {
      name: 'The collage could not be created.',
    });
    await expect(error).toBeVisible();
    await expect(error).toContainText('Your photos are saved.');
    await expect(photoView(page)).toBeHidden();

    graphql.restore('FinalizeCollage');
    await error.getByRole('button', { name: 'Try again' }).click();
    await expect(error).toBeHidden();
    await expect(photoView(page)).toBeVisible();
    expect(graphql.callsTo('FinalizeCollage')).toHaveLength(2);
  });

  test('"Start over" after a failed collage begins a new one', async ({
    page,
    graphql,
  }) => {
    graphql.fail('FinalizeCollage');
    await openCollage(page);
    await shootAndAccept(page, 'Photo 1 of 2');
    await shootAndAccept(page, 'Photo 2 of 2');

    const error = page.getByRole('alertdialog', {
      name: 'The collage could not be created.',
    });
    await error.getByRole('button', { name: 'Start over' }).click();
    await expect(error).toBeHidden();
    await expect(page.getByText('Photo 1 of 2').first()).toBeVisible();
    await expect.poll(() => graphql.callsTo('StartCollage').length).toBe(2);
    expect(graphql.callsTo('ResetCollage')).toHaveLength(1);
  });

  test('a collage that cannot be started sends the operator to the settings', async ({
    page,
    graphql,
  }) => {
    graphql.handle('StartCollage', () => ({
      data: {
        startCollage: { success: false, message: 'Template not found' },
      },
    }));
    await startBooth(page);
    await page.getByRole('button', { name: /Collage/ }).click();

    await expect(
      snackbar(page, 'Could not start collage. Check template settings.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
  });

  test('a photo the collage rejects is not counted', async ({
    page,
    graphql,
  }) => {
    graphql.handle('AddPhotoToCollage', () => ({
      data: {
        addPhotoToCollage: { success: false, message: 'No collage started' },
      },
    }));
    await openCollage(page);
    await shootAndAccept(page, 'Photo 1 of 2');

    await expect(
      snackbar(page, 'Could not add photo to collage.'),
    ).toBeVisible();
    await expect(page.getByText('Photo 1 of 2').first()).toBeVisible();
    expect(graphql.callsTo('FinalizeCollage')).toHaveLength(0);
  });
});
