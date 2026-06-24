import { execSync } from 'node:child_process';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

const skipElectronRebuild =
  process.env.SKIP_ELECTRON_POSTINSTALL === 'true' ||
  (process.env.CI === 'true' && process.platform !== 'win32');

if (!skipElectronRebuild) {
  run('electron-builder install-app-deps');
} else {
  console.log(
    'Skipping electron-builder install-app-deps (non-Windows CI or SKIP_ELECTRON_POSTINSTALL).',
  );
}

if (process.env.SKIP_PLAYWRIGHT_INSTALL !== 'true') {
  const skipBrowserDownload =
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1' ||
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === 'true';
  if (skipBrowserDownload) {
    console.log(
      'Skipping Playwright browser download (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD).',
    );
  } else {
    run('npx playwright install chromium');
  }
}
