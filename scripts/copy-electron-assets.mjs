#!/usr/bin/env node
/**
 * Copy pre-built UI bundles and runtime assets into the electron dist folder.
 * Kept outside rspack so production mode does not re-minify Angular ESM chunks.
 */
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const out = join(root, 'dist/apps/fotobox-electron');

async function copyDir(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

const copies = [
  [join(root, 'dist/apps/fotobox-ui'), join(out, 'fotobox-ui')],
  [
    join(root, 'dist/apps/collage-editor-ui/browser'),
    join(out, 'collage-editor-ui'),
  ],
  [join(root, 'libs/collage-maker/src/images'), join(out, 'images')],
  [join(root, 'libs/collage-maker/src/templates'), join(out, 'collage-templates')],
  [join(root, 'libs/nest/database/drizzle'), join(out, 'drizzle')],
];

for (const [from, to] of copies) {
  await copyDir(from, to);
}

// Demo camera JPEGs only
const demoFrom = join(root, 'libs/cameras/src/demo');
const demoTo = join(out, 'demo-camera');
await mkdir(demoTo, { recursive: true });
const { readdir } = await import('node:fs/promises');
for (const file of await readdir(demoFrom)) {
  if (file.endsWith('.jpg')) {
    await cp(join(demoFrom, file), join(demoTo, file), { force: true });
  }
}

console.log('Copied UI and runtime assets into dist/apps/fotobox-electron');
