import { expect, test } from './support/fixtures';

test.describe('Editor save conflict', () => {
  test.beforeEach(async ({ projectList, editor }): Promise<void> => {
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('confirms overwrite when template id already exists', async ({
    editor,
    graphql,
  }): Promise<void> => {
    await editor.setProjectId('existing-template');
    await editor.setProjectName('Replacement template');
    await editor.photoPaneButton.click();
    await editor.saveStay();

    await expect(editor.dialog).toContainText('existing-template');
    await expect(editor.dialog).toContainText('Replace template?');
    await editor.confirmDialog();

    await expect(editor.saveState).toContainText('Saved');
    expect(graphql.savedProjects.get('existing-template')?.['name']).toBe(
      'Replacement template',
    );
  });

  test('cancels save when overwrite is declined', async ({
    editor,
    graphql,
  }): Promise<void> => {
    await editor.setProjectId('existing-template');
    await editor.setProjectName('Should not save');
    await editor.photoPaneButton.click();
    await editor.saveStay();

    await editor.cancelDialog();
    await expect(editor.dialog).toHaveCount(0);
    await expect(editor.saveState).toContainText('Unsaved changes');
    expect(graphql.savedProjects.get('existing-template')?.['name']).toBe(
      'Existing template',
    );
  });
});
