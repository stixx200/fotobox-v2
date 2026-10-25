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

  test('lists saved projects from the API', async ({
    projectList,
  }): Promise<void> => {
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

    await projectList.duplicate('Existing template');
    await expect(projectList.projectCards).toHaveCount(2);
    expect(
      graphql.projects.some((p) => p.id === 'existing-template-kopie'),
    ).toBe(true);

    await projectList.requestDelete('Existing template');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Delete template?');
    await page.getByTestId('confirm-accept').click();
    await expect(projectList.projectCards).toHaveCount(1);
    expect(graphql.projects.some((p) => p.id === 'existing-template')).toBe(
      false,
    );
  });
});

test.describe('Project list error handling', () => {
  test('keeps the project when deletion is cancelled', async ({
    page,
    projectList,
    graphql,
  }): Promise<void> => {
    await projectList.goto();
    await projectList.requestDelete('Existing template');
    await page.getByTestId('confirm-cancel').click();

    await expect(projectList.projectCards).toHaveCount(1);
    expect(graphql.projects).toHaveLength(1);
  });

  test('shows a readable error with retry when the API is unreachable', async ({
    page,
    projectList,
    graphql: _graphql,
  }): Promise<void> => {
    const fail = (route: import('@playwright/test').Route) => route.abort();
    await page.route('**/graphql', fail);
    await projectList.goto();

    await expect(projectList.errorBanner).toContainText(
      "The Fotobox service can't be reached",
    );
    await expect(projectList.errorBanner).not.toContainText('Http failure');
    await expect(projectList.emptyState).toHaveCount(0);

    await page.unroute('**/graphql', fail);
    await projectList.errorBanner
      .getByRole('button', { name: 'Try again' })
      .click();
    await expect(projectList.errorBanner).toHaveCount(0);
    await expect(projectList.projectCards).toHaveCount(1);
  });
});
