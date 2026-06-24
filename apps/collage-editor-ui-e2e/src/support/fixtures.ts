import { test as base, expect } from '@playwright/test';
import {
  CollageEditorGraphqlMock,
  mockCollageEditorGraphql,
} from './graphql-mock';
import { useEnglishLocale } from './locale';
import { EditorPage } from './pages/editor.page';
import { ProjectListPage } from './pages/project-list.page';

type CollageEditorFixtures = {
  graphql: CollageEditorGraphqlMock;
  projectList: ProjectListPage;
  editor: EditorPage;
};

export const test = base.extend<CollageEditorFixtures>({
  graphql: async ({ page }, use) => {
    await useEnglishLocale(page);
    const mock = await mockCollageEditorGraphql(page);
    await use(mock);
  },

  projectList: async ({ page, graphql: _graphql }, use) => {
    await use(new ProjectListPage(page));
  },

  editor: async ({ page, graphql: _graphql }, use) => {
    await use(new EditorPage(page));
  },
});

export { expect };
