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
  /** Save state in the top bar ("New – not saved yet", "Saved", …). */
  readonly saveState: Locator;
  readonly backButton: Locator;
  readonly snackBar: Locator;
  readonly dialog: Locator;

  constructor(readonly page: Page) {
    this.canvas = page.locator('.canvas-wrap canvas').first();
    this.canvasWrap = page.locator('.canvas-wrap');
    this.photoPaneButton = page.getByTestId('add-photo-pane');
    this.layersTab = page.getByRole('tab', { name: 'Layers', exact: true });
    this.projectTab = page.getByRole('tab', { name: 'Project', exact: true });
    this.projectSettings = page.locator('.project-settings');
    this.photoLayers = page.locator('.photo-list .layer-item');
    this.decorationLayers = page.locator('.decoration-list .layer-item');
    this.saveState = page.getByTestId('save-state');
    this.backButton = page.getByTestId('editor-back');
    this.snackBar = page.locator('mat-snack-bar-container');
    this.dialog = page.getByRole('dialog');
  }

  async expectLoaded(): Promise<void> {
    await this.photoPaneButton.waitFor({ state: 'visible' });
    await this.canvas.waitFor({ state: 'visible' });
  }

  async addTextLayer(): Promise<void> {
    await this.page.getByTestId('add-text').click();
  }

  async addPreset(presetName: string | RegExp): Promise<void> {
    await this.page.getByTestId('add-decoration').click();
    await this.page.getByRole('menuitem', { name: presetName }).click();
  }

  async saveAndClose(): Promise<void> {
    await this.page.getByTestId('save-options').click();
    await this.page.getByRole('menuitem', { name: 'Save & close' }).click();
  }

  async saveStay(): Promise<void> {
    await this.page.getByTestId('save').click();
  }

  async confirmDialog(): Promise<void> {
    await this.page.getByTestId('confirm-accept').click();
  }

  async cancelDialog(): Promise<void> {
    await this.page.getByTestId('confirm-cancel').click();
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
      .getByRole('switch', { name: 'Smart guides (magnetic)' })
      .click();
  }
}
