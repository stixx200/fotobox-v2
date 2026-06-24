import { test as base, expect } from '@playwright/test';
import { FotoboxUiGraphqlMock, mockFotoboxUiGraphql } from './graphql-mock';
import { useEnglishLocale } from './locale';

type FotoboxUiFixtures = {
  graphql: FotoboxUiGraphqlMock;
};

export const test = base.extend<FotoboxUiFixtures>({
  graphql: async ({ page }, use) => {
    await useEnglishLocale(page);
    const mock = await mockFotoboxUiGraphql(page);
    await use(mock);
  },
});

export { expect };
