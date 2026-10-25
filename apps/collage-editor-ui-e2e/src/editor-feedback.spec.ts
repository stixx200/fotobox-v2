import type { Route } from '@playwright/test';
import { expect, test } from './support/fixtures';

test.describe('Editor feedback and error handling', () => {
  test.beforeEach(async ({ projectList, editor }): Promise<void> => {
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('blocks saving without a photo pane and explains why', async ({
    editor,
    graphql,
  }): Promise<void> => {
    await editor.saveStay();

    await expect(editor.snackBar).toContainText(
      "Can't save: The template needs at least one photo pane.",
    );
    await expect(editor.page.getByTestId('validation-panel')).toBeVisible();
    expect(graphql.savedProjects.size).toBe(1);
  });

  test('keeps changes and offers retry when saving fails', async ({
    page,
    editor,
    graphql,
  }): Promise<void> => {
    await editor.setProjectId('retry-template');
    await editor.photoPaneButton.click();

    const fail = (route: Route) => route.abort();
    await page.route('**/graphql', fail);
    await editor.saveStay();

    await expect(editor.snackBar).toContainText(
      "The Fotobox service can't be reached",
    );
    await expect(editor.saveState).toContainText('Unsaved changes');

    await page.unroute('**/graphql', fail);
    await editor.snackBar.getByRole('button', { name: 'Try again' }).click();
    await expect(editor.saveState).toContainText('Saved');
    expect(graphql.savedProjects.has('retry-template')).toBe(true);
  });

  test('asks before leaving with unsaved changes', async ({
    page,
    editor,
  }): Promise<void> => {
    await editor.photoPaneButton.click();
    await expect(editor.saveState).toContainText('Unsaved changes');

    await editor.backButton.click();
    await expect(editor.dialog).toContainText('Discard changes?');
    await page.getByTestId('confirm-cancel').click();
    await expect(editor.dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/editor\/?$/);

    await editor.backButton.click();
    await page.getByTestId('confirm-accept').click();
    await expect(page).toHaveURL('/');
  });

  test('derives the template id from the name for new templates', async ({
    editor,
  }): Promise<void> => {
    await editor.setProjectName('Summer Party 2026');
    await expect(
      editor.projectSettings.getByRole('textbox', { name: 'ID', exact: true }),
    ).toHaveValue('summer-party-2026');
  });

  test('places new photo panes without overlapping', async ({
    editor,
  }): Promise<void> => {
    await editor.photoPaneButton.click();
    await editor.photoPaneButton.click();
    await expect(editor.photoLayers).toHaveCount(2);
    await expect(editor.page.getByTestId('validation-panel')).not.toContainText(
      'overlap',
    );
  });
});

test.describe('Editor load errors', () => {
  test('shows a recovery screen for a missing template', async ({
    page,
    graphql: _graphql,
  }): Promise<void> => {
    await page.goto('/editor/does-not-exist');

    const error = page.getByTestId('load-error');
    await expect(error).toContainText("Couldn't open the template");
    await error.getByRole('button', { name: 'Back to overview' }).click();
    await expect(page).toHaveURL('/');
  });
});
