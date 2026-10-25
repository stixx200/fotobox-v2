#!/usr/bin/env node
/**
 * Stage the API sidecar for Tauri:
 *  - `src-tauri/binaries/node-<target-triple>`: the Node runtime running this
 *    script (Node >= 22.5 is required for `node:sqlite`).
 *  - `dist/apps/fotobox-tauri/api`: the fotobox-api bundle plus a flat
 *    production node_modules installed from its pruned lockfile. A hoisted
 *    layout is used because bundlers and installers don't handle pnpm's
 *    symlinked store.
 */
import { execFileSync } from 'node:child_process';
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const apiBuild = join(root, 'dist/apps/fotobox-api');
const apiOut = join(root, 'dist/apps/fotobox-tauri/api');
const binariesDir = join(root, 'apps/fotobox-tauri/src-tauri/binaries');
const isWindows = process.platform === 'win32';

function hostTargetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  const info = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const host = /^host: (\S+)$/m.exec(info)?.[1];
  if (!host) {
    throw new Error('Could not determine the Rust host target triple');
  }
  return host;
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  throw new Error(
    `Node ${process.versions.node} lacks node:sqlite; use Node >= 22.5`,
  );
}

// 1. Node runtime as Tauri externalBin
const triple = hostTargetTriple();
await mkdir(binariesDir, { recursive: true });
const nodeTarget = join(
  binariesDir,
  `node-${triple}${isWindows ? '.exe' : ''}`,
);
await copyFile(process.execPath, nodeTarget);
await chmod(nodeTarget, 0o755);
console.log(`Node ${process.version} -> ${nodeTarget}`);

// 2. API bundle + production dependencies
await stat(join(apiBuild, 'main.js')).catch(() => {
  throw new Error(
    `Missing API build in ${apiBuild} (run fotobox-api:build first)`,
  );
});
await rm(apiOut, { recursive: true, force: true });
await cp(apiBuild, apiOut, {
  recursive: true,
  filter: (source) => !source.endsWith('.map'),
});

const workspaceFile = join(apiOut, 'pnpm-workspace.yaml');
const workspace = await readFile(workspaceFile, 'utf8').catch(
  () => 'packages: []\n',
);
await writeFile(workspaceFile, `${workspace.trimEnd()}\nnodeLinker: hoisted\n`);

const pnpm = process.env.FOTOBOX_PNPM ?? 'pnpm';
execFileSync(pnpm, ['install', '--prod', '--frozen-lockfile'], {
  cwd: apiOut,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env, CI: 'true' },
});

// Build-time only: CLI shims, and TypeScript (optional peer of
// @nestjs/graphql, used by its compiler plugin, never at runtime).
for (const unused of ['.bin', 'typescript']) {
  await rm(join(apiOut, 'node_modules', unused), {
    recursive: true,
    force: true,
  });
}

console.log(`Staged API sidecar in ${apiOut}`);
