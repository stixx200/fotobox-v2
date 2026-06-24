import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import * as inspector from 'node:inspector';
import pathToElectron from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocalPath = join(__dirname, '..', '.env.local');

const devDefaults = {
  FOTOBOX_DEV_SERVER: 'http://localhost:4200',
  FOTOBOX_COLLAGE_EDITOR_DEV_SERVER: 'http://localhost:4201',
};

for (const [key, value] of Object.entries(devDefaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const processArgs = [...process.argv.slice(2)];
const inspectorUrl = inspector.url();
if (inspectorUrl) {
  inspector.close();
}

// Cursor / @nx/js:node may set ELECTRON_RUN_AS_NODE=1, which makes Electron
// behave as plain Node and breaks require('electron') in the main process.
const electronEnv = { ...process.env };
delete electronEnv.ELECTRON_RUN_AS_NODE;

const proc = spawn(pathToElectron, processArgs, {
  stdio: 'inherit',
  env: electronEnv,
});
proc.on('exit', (code) => {
  process.exitCode = code;
});

await once(proc, 'close');
process.exit();
