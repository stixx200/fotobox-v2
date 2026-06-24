#!/usr/bin/env node
/**
 * Fail fast before electron-builder if rspack output is missing static assets.
 */
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '../dist/apps/fotobox-electron');

const requiredPaths = [
  'main.js',
  'main.preload.js',
  'fotobox-ui/index.html',
  'collage-editor-ui/index.html',
  'drizzle',
  'collage-templates',
  'images',
];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const missing = [];
for (const relative of requiredPaths) {
  const full = join(distRoot, relative);
  if (!(await exists(full))) {
    missing.push(relative);
  }
}

if (missing.length > 0) {
  console.error(
    'fotobox-electron dist is incomplete. Missing:\n' +
      missing.map((p) => `  - ${p}`).join('\n') +
      '\n\nRun UI + electron production builds first.',
  );
  process.exit(1);
}

console.log('fotobox-electron dist verification passed.');
