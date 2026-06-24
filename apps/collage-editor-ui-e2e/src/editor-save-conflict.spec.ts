import { expect, test } from './support/fixtures';

test.describe('Editor save conflict', () => {
  test.beforeEach(async ({ projectList, editor }): Promise<void> => {
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('confirms overwrite when template id already exists', async ({
    page,
    editor,
    graphql,
  }): Promise<void> => {
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('existing-template');
      await dialog.accept();
    });

    await editor.setProjectId('existing-template');
    await editor.setProjectName('Replacement template');
    await editor.photoPaneButton.click();
    await editor.saveStay();

    await expect(editor.status).toHaveText('Saved');
    expect(graphql.savedProjects.get('existing-template')?.['name']).toBe(
      'Replacement template',
    );
  });

  test('cancels save when overwrite is declined', async ({
    page,
    editor,
    graphql,
  }): Promise<void> => {
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await editor.setProjectId('existing-template');
    await editor.setProjectName('Should not save');
    await editor.photoPaneButton.click();
    await editor.saveStay();

    await expect(editor.status).toHaveCount(0);
    expect(graphql.savedProjects.get('existing-template')?.['name']).toBe(
      'Existing template',
    );
  });
});
