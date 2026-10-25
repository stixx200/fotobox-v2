import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'node:path';
import { workspacePaths } from '@fotobox/workspace-paths';

/**
 * Nx-style Playwright e2e for collage-editor-ui.
 * Run: pnpm nx run collage-editor-ui-e2e:e2e
 * UI mode: pnpm nx run collage-editor-ui-e2e:e2e-ui
 */
/** Override with E2E_PORT when 5102 is taken by another dev server. */
const port = Number(process.env['E2E_PORT'] ?? 5102);
const baseURL = process.env['BASE_URL'] ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: workspacePaths.playwrightReport() },
    ],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec nx run collage-editor-ui:serve:development --port=${port}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: workspacePaths.playwrightTestResults(),
});
