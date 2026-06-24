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
  run('npx playwright install chromium');
}
