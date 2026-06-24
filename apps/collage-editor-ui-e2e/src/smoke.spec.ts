import { expect, test } from './support/fixtures';

test.describe('Collage editor smoke', () => {
  test('creates a template with photo and text layers and saves it', async ({
    page,
    projectList,
    editor,
    graphql,
  }): Promise<void> => {
    graphql.projects.length = 0;
    await projectList.goto();
    await expect(projectList.emptyState).toBeVisible();

    await projectList.createNewTemplate();
    await editor.expectLoaded();

    await editor.setProjectId('smoke-test');
    await editor.setProjectName('Smoke test template');
    await editor.photoPaneButton.click();
    await editor.addTextLayer();

    await editor.layersTab.click();
    await expect(editor.photoLayers).toHaveCount(1);
    await expect(editor.decorationLayers).toHaveCount(1);

    await editor.saveAndClose();

    await expect(page).toHaveURL('/');
    await expect(projectList.projectLink('Smoke test template')).toBeVisible();
  });
});
