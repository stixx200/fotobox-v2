import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { snackbar } from './support/booth';

const SAVED = 'All changes saved';

function saveStatus(page: Page) {
  return page.locator('.autosave-status');
}

async function openSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Fotobox Settings' }),
  ).toBeVisible();
}

test.describe('Settings auto-save', () => {
  test('saves only the changed setting', async ({ page, graphql }) => {
    let release!: () => void;
    const answered = new Promise<void>((resolve) => (release = resolve));
    graphql.handle('UpdateSettings', async (variables) => {
      await answered;
      const { settings } = variables['input'] as {
        settings: { key: string; value: string }[];
      };
      return {
        data: {
          updateSettings: settings.map((s) => ({ ...s, description: '' })),
        },
      };
    });
    await openSettings(page);

    await page.getByLabel('Shutter delay').fill('3');
    await expect(saveStatus(page)).toContainText('Saving…');
    release();
    await expect(saveStatus(page)).toContainText(SAVED);

    expect(graphql.callsTo('UpdateSettings')).toEqual([
      { input: { settings: [{ key: 'shutterTimeout', value: '3' }] } },
    ]);
  });

  test('a failed save can be retried', async ({ page, graphql }) => {
    graphql.fail('UpdateSettings', 'Database locked');
    await openSettings(page);

    await page.getByLabel('Shutter delay').fill('7');
    await expect(saveStatus(page)).toContainText('Saving failed');

    graphql.restore('UpdateSettings');
    await saveStatus(page).getByRole('button', { name: 'Retry' }).click();
    await expect(saveStatus(page)).toContainText(SAVED);
    await expect(saveStatus(page).getByRole('button')).toHaveCount(0);

    const change = {
      input: { settings: [{ key: 'shutterTimeout', value: '7' }] },
    };
    expect(graphql.callsTo('UpdateSettings')).toEqual([change, change]);
  });

  test('an incomplete operator PIN is saved only once complete', async ({
    page,
    graphql,
  }) => {
    await openSettings(page);
    const pin = page.getByLabel('Operator PIN');

    await pin.pressSequentially('12');
    await expect(saveStatus(page)).toContainText(
      'Incomplete input is saved once it is valid',
    );
    expect(graphql.callsTo('UpdateSettings')).toHaveLength(0);

    await pin.pressSequentially('34');
    await expect(saveStatus(page)).toContainText(SAVED);
    expect(graphql.callsTo('UpdateSettings')).toEqual([
      { input: { settings: [{ key: 'operatorPin', value: '"1234"' }] } },
    ]);
  });
});

test.describe('Restore defaults', () => {
  test.beforeEach(({ graphql }) => {
    graphql.setSettings({ shutterTimeout: 9, usePrinter: false });
  });

  test('cancel keeps the current values', async ({ page, graphql }) => {
    await openSettings(page);
    await expect(page.getByLabel('Shutter delay')).toHaveValue('9');

    await page.getByRole('button', { name: 'Restore defaults' }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Restore default settings?',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByLabel('Shutter delay')).toHaveValue('9');
    expect(graphql.callsTo('UpdateSettings')).toHaveLength(0);
  });

  test('confirm resets every field and saves it', async ({ page, graphql }) => {
    await openSettings(page);

    await page.getByRole('button', { name: 'Restore defaults' }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Restore default settings?',
    });
    await dialog.getByRole('button', { name: 'Reset' }).click();

    await expect(snackbar(page, 'Default settings restored')).toBeVisible();
    await expect(saveStatus(page)).toContainText(SAVED);
    await expect(page.getByLabel('Shutter delay')).toHaveValue('5');
    await expect(page.getByLabel('Enable printer')).toBeChecked();

    const [save] = graphql.callsTo('UpdateSettings') as {
      input: { settings: { key: string; value: string }[] };
    }[];
    const saved = Object.fromEntries(
      save.input.settings.map(({ key, value }) => [key, value]),
    );
    expect(saved).toMatchObject({ shutterTimeout: '5', usePrinter: 'true' });
    // Unchanged values are not sent; the available printer is kept.
    expect(saved).not.toHaveProperty('printerName');
    expect(saved).not.toHaveProperty('useShare');
  });
});

test.describe('Start Fotobox', () => {
  test('saves pending changes before opening the booth', async ({
    page,
    graphql,
  }) => {
    await openSettings(page);

    // Start right away, before the auto-save delay has passed.
    await page.getByLabel('Shutter delay').fill('2');
    await page.getByRole('button', { name: 'Start Fotobox' }).click();
    await expect(page).toHaveURL(/\/layouts\/single/);

    expect(graphql.callsTo('UpdateSettings')).toEqual([
      { input: { settings: [{ key: 'shutterTimeout', value: '2' }] } },
    ]);
    const order = graphql.calls.map((call) => call.operation);
    expect(order.indexOf('UpdateSettings')).toBeLessThan(
      order.indexOf('InitializeCamera'),
    );
  });

  test('a camera that does not start shows the error banner', async ({
    page,
    graphql,
  }) => {
    graphql.handle('InitializeCamera', () => ({
      data: {
        initializeCamera: { success: false, message: 'Camera not connected' },
      },
    }));
    await openSettings(page);

    await page.getByRole('button', { name: 'Start Fotobox' }).click();
    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'The photo booth could not be started.' });
    await expect(banner).toBeVisible();
    await page.getByText('Technical details').click();
    await expect(banner.getByText('Camera not connected')).toBeVisible();

    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole('button', { name: 'Start Fotobox' }),
    ).toBeEnabled();
  });
});

test.describe('Settings header', () => {
  test('the toolbar stays in place when switching the language', async ({
    page,
    graphql: _graphql,
  }) => {
    await openSettings(page);
    // Measure once the (icon) fonts are in, they change the toolbar width.
    await page.evaluate(() => document.fonts.ready);
    const toolbar = page.locator('.header-toolbar');
    const before = await toolbar.boundingBox();
    expect(before).not.toBeNull();

    await page.getByRole('radio', { name: 'Deutsch' }).click();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Einstellungen' }),
    ).toBeVisible();
    await expect.poll(() => toolbar.boundingBox()).toEqual(before);

    await page.getByRole('radio', { name: 'English' }).click();
    await expect(
      page.getByRole('heading', { name: 'Fotobox Settings' }),
    ).toBeVisible();
    await expect.poll(() => toolbar.boundingBox()).toEqual(before);
  });
});
