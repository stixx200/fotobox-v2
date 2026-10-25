import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { workspacePaths } from '@fotobox/workspace-paths';

/** Override with E2E_PORT when 5101 is taken by another dev server. */
const port = Number(process.env['E2E_PORT'] ?? 5101);
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
    command: `pnpm exec nx run fotobox-ui:serve:development --port=${port}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    cwd: workspaceRoot,
    // The Angular dev server disables its cache (and with it dependency
    // prebundling) when CI is set; CommonJS packages loaded lazily, such as
    // `qrcode` for the share QR code, then fail to import.
    env: { ...process.env, CI: '' } as Record<string, string>,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: workspacePaths.playwrightTestResults(),
});
