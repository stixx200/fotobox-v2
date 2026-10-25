#!/usr/bin/env node
/**
 * Assemble the Tauri frontend: the kiosk UI at the root and the collage
 * editor under /collage-editor/ (opened by the `open_collage_editor` command).
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'dist/apps/fotobox-tauri/web');

const sources = [
  [join(root, 'dist/apps/fotobox-ui'), out],
  [
    join(root, 'dist/apps/collage-editor-ui/browser'),
    join(out, 'collage-editor'),
  ],
];

for (const [from] of sources) {
  await stat(join(from, 'index.html')).catch(() => {
    throw new Error(`Missing UI build: ${from} (run the UI build first)`);
  });
}

await rm(out, { recursive: true, force: true });
for (const [from, to] of sources) {
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true });
}

console.log(`Assembled Tauri frontend in ${out}`);
