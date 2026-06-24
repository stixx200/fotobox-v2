import { expect, test } from './support/fixtures';

test.describe('Editor workspace', () => {
  test.beforeEach(async ({ projectList, editor }): Promise<void> => {
    await projectList.goto();
    await projectList.createNewTemplate();
    await editor.expectLoaded();
  });

  test('shows a centered white canvas on a grey workspace', async ({
    editor,
  }): Promise<void> => {
    await expect(editor.canvasWrap).toBeVisible();
    await expect(editor.canvasWrap).toHaveCSS(
      'background-color',
      'rgb(203, 213, 225)',
    );

    const canvasContainer = editor.canvasWrap.locator('.canvas-container');
    await expect(canvasContainer).toBeVisible();

    const wrapBox = await editor.canvasWrap.boundingBox();
    const artboardBox = await canvasContainer.boundingBox();
    expect(wrapBox).not.toBeNull();
    expect(artboardBox).not.toBeNull();
    if (wrapBox && artboardBox) {
      expect(artboardBox.width).toBeLessThan(wrapBox.width);
      expect(artboardBox.height).toBeLessThan(wrapBox.height);
      const artboardCenterX = artboardBox.x + artboardBox.width / 2;
      const wrapCenterX = wrapBox.x + wrapBox.width / 2;
      expect(Math.abs(artboardCenterX - wrapCenterX)).toBeLessThan(24);
    }
  });

  test('adds decoration presets to the layers panel', async ({
    editor,
  }): Promise<void> => {
    await editor.addPreset(/Confetti/);
    await editor.layersTab.click();
    await expect(editor.decorationLayers).toHaveCount(1);
    await expect(editor.decorationLayers.first()).toContainText('Confetti');
  });

  test('can enable magnetic smart guides', async ({ editor }): Promise<void> => {
    await editor.toggleMagneticGuides();
    await expect(
      editor.page.getByRole('checkbox', { name: 'Smart guides (magnetic)' }),
    ).toBeChecked();
  });
});
