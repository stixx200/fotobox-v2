import type { Locator, Page } from '@playwright/test';

export class ProjectListPage {
  readonly heading: Locator;
  readonly newTemplateButton: Locator;
  readonly emptyState: Locator;
  readonly projectCards: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', {
      name: 'Collage Template Editor',
      level: 1,
    });
    this.newTemplateButton = page.getByRole('button', { name: 'New template' });
    this.emptyState = page.getByText('No editor projects yet.');
    this.projectCards = page.locator('.project-card');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.heading.waitFor({ state: 'visible' });
  }

  async createNewTemplate(): Promise<void> {
    await this.newTemplateButton.click();
    await this.page.waitForURL(/\/editor\/?$/);
  }

  projectCard(title: string): Locator {
    return this.page.locator('.project-card').filter({
      has: this.page.locator('strong', {
        hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      }),
    });
  }

  projectLink(title: string): Locator {
    return this.projectCard(title).getByRole('button').first();
  }

  duplicateButton(title: string): Locator {
    return this.projectCard(title).getByRole('button', { name: 'Duplicate' });
  }

  deleteButton(title: string): Locator {
    return this.projectCard(title).getByRole('button', { name: 'Delete' });
  }
}
