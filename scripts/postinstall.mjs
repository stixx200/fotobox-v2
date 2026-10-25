import { execSync } from 'node:child_process';

function run(command) {
  execSync(command, { stdio: 'inherit' });
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
    run('playwright install chromium');
  }
}
