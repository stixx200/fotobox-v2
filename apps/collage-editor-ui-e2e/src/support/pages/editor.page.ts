import type { Locator, Page } from '@playwright/test';

export class EditorPage {
  readonly canvas: Locator;
  readonly canvasWrap: Locator;
  readonly photoPaneButton: Locator;
  readonly layersTab: Locator;
  readonly projectTab: Locator;
  readonly projectSettings: Locator;
  readonly photoLayers: Locator;
  readonly decorationLayers: Locator;
  readonly status: Locator;

  constructor(readonly page: Page) {
    this.canvas = page.locator('.canvas-wrap canvas').first();
    this.canvasWrap = page.locator('.canvas-wrap');
    this.photoPaneButton = page.getByRole('button', { name: '+ Photo pane' });
    this.layersTab = page.getByRole('button', { name: 'Layers', exact: true });
    this.projectTab = page.getByRole('button', { name: 'Project', exact: true });
    this.projectSettings = page.locator('.project-settings');
    this.photoLayers = page.locator('.photo-list .layer-item');
    this.decorationLayers = page
      .locator('section.layer-group')
      .filter({ has: page.getByRole('heading', { name: 'Decorations' })
      })
      .locator('.layer-item');
    this.status = page.locator('.status');
  }

  async expectLoaded(): Promise<void> {
    await this.photoPaneButton.waitFor({ state: 'visible' });
    await this.canvas.waitFor({ state: 'visible' });
  }

  async openToolbarMenu(triggerName: string | RegExp): Promise<Locator> {
    const group = this.page.locator('.toolbar-group').filter({
      has: this.page.getByRole('button', { name: triggerName }),
    });
    await group.getByRole('button').first().hover();
    const flyout = group.locator('.toolbar-flyout');
    await flyout.waitFor({ state: 'visible' });
    return flyout;
  }

  async addTextLayer(): Promise<void> {
    const flyout = await this.openToolbarMenu('Content');
    await flyout.getByRole('menuitem', { name: 'Text' }).click();
  }

  async addPreset(presetName: string | RegExp): Promise<void> {
    const flyout = await this.openToolbarMenu('Presets');
    await flyout.getByRole('menuitem', { name: presetName }).click();
  }

  async saveAndClose(): Promise<void> {
    const flyout = await this.openToolbarMenu(/^Save$/);
    await flyout.getByRole('menuitem', { name: 'Save & close' }).click();
  }

  async saveStay(): Promise<void> {
    const flyout = await this.openToolbarMenu(/^Save$/);
    await flyout.getByRole('menuitem', { name: 'Save', exact: true }).click();
  }

  async setProjectId(id: string): Promise<void> {
    await this.projectTab.click();
    const input = this.projectSettings.getByRole('textbox', {
      name: 'ID',
      exact: true,
    });
    await input.fill(id);
    await input.blur();
  }

  async setProjectName(name: string): Promise<void> {
    await this.projectTab.click();
    const input = this.projectSettings.getByRole('textbox', {
      name: 'Name',
      exact: true,
    });
    await input.fill(name);
    await input.blur();
  }

  async toggleMagneticGuides(): Promise<void> {
    await this.layersTab.click();
    await this.page
      .getByRole('checkbox', { name: 'Smart guides (magnetic)' })
      .check();
  }
}
