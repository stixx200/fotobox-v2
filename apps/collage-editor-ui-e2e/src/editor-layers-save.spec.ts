import { expect, test } from './support/fixtures';

test.describe('Editor layers and save', () => {
  test.beforeEach(async ({ projectList, editor }): Promise<void> => {
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('adds photo and text layers', async ({ editor }): Promise<void> => {
    await editor.photoPaneButton.click();
    await editor.addTextLayer();

    await editor.layersTab.click();
    await expect(editor.photoLayers).toHaveCount(1);
    await expect(editor.decorationLayers).toHaveCount(1);
    await expect(editor.photoLayers.first()).toContainText(/photo/i);
    await expect(editor.decorationLayers.first()).toContainText(/text/i);
  });

  test('saves and returns to the project list', async ({
    page,
    projectList,
    editor,
    graphql,
  }): Promise<void> => {
    await editor.setProjectId('e2e-template');
    await editor.setProjectName('E2E template');
    await editor.photoPaneButton.click();

    await editor.saveAndClose();

    await expect(page).toHaveURL('/');
    await expect(projectList.projectLink('E2E template')).toBeVisible();
    expect(graphql.projects.some((p) => p.id === 'e2e-template')).toBe(true);
  });

  test('save stay keeps the editor open', async ({
    page,
    editor,
  }): Promise<void> => {
    await editor.setProjectId('stay-open');
    await editor.setProjectName('Stay open');
    await editor.photoPaneButton.click();

    await editor.saveStay();

    await expect(editor.status).toHaveText('Saved');
    await expect(page).toHaveURL(/\/editor\/?$/);
    await expect(editor.photoPaneButton).toBeVisible();
  });
});
