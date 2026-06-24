import { expect, test } from './support/fixtures';

test.describe('Project list', () => {
  test('shows empty state when no projects exist', async ({
    projectList,
    graphql,
  }): Promise<void> => {
    graphql.projects.length = 0;
    await projectList.goto();

    await expect(projectList.heading).toBeVisible();
    await expect(projectList.emptyState).toBeVisible();
    await expect(projectList.newTemplateButton).toBeEnabled();
  });

  test('lists saved projects from the API', async ({ projectList }): Promise<void> => {
    await projectList.goto();

    await expect(projectList.projectCards).toHaveCount(1);
    await expect(projectList.projectLink('Existing template')).toBeVisible();
  });

  test('opens the editor for a new template', async ({
    projectList,
    editor,
    graphql,
  }): Promise<void> => {
    graphql.projects.length = 0;
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('duplicates and deletes a project', async ({
    page,
    projectList,
    graphql,
  }): Promise<void> => {
    await projectList.goto();
    await expect(projectList.projectCards).toHaveCount(1);

    await projectList.duplicateButton('Existing template').click();
    await expect(projectList.projectCards).toHaveCount(2);

    page.once('dialog', (dialog) => dialog.accept());
    await projectList.deleteButton('Existing template').click();
    await expect(projectList.projectCards).toHaveCount(1);
    expect(graphql.projects.some((p) => p.id === 'existing-template')).toBe(
      false,
    );
  });
});
