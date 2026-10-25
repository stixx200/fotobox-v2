import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll } from 'vitest';

/**
 * Vitest setup file (runs before each test file is imported): every data path
 * the API touches points at a fresh temp dir, so tests never read or write the
 * developer's runtime data and test files can run in parallel.
 *
 * Must run before any `@fotobox/*` import: the logger and the photo storage
 * singleton read these variables when they are first created.
 */
const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-api-it-'));

const testDirs = {
  photos: path.join(root, 'photos'),
  templates: path.join(root, 'collage-templates'),
  data: path.join(root, 'data'),
  logs: path.join(root, 'logs'),
};

for (const dir of Object.values(testDirs)) {
  fs.mkdirSync(dir, { recursive: true });
}

Object.assign(process.env, {
  FOTOBOX_IT_ROOT: root,
  FOTOBOX_PHOTO_DIR: testDirs.photos,
  FOTOBOX_TEMPLATE_DIR: testDirs.templates,
  FOTOBOX_SETTINGS_PATH: path.join(testDirs.data, 'settings.json'),
  FOTOBOX_DATABASE_PATH: path.join(testDirs.data, 'fotobox.db'),
  FOTOBOX_LOG_FILE: path.join(testDirs.logs, 'application.log'),
  // The templates shipped with the API bundle (copied by webpack from here).
  FOTOBOX_BUILTIN_TEMPLATE_DIR: path.join(
    workspaceRoot,
    'libs/collage-maker/src/templates',
  ),
});

// Ambient settings of the developer's shell must not change the outcome.
for (const name of [
  'FOTOBOX_ALLOW_LAN_API',
  'FOTOBOX_LAN_API_TOKEN',
  'FOTOBOX_TRUSTED_ORIGINS',
  'FOTOBOX_GRAPHQL_BODY_LIMIT',
  'PORT',
  'HOST',
]) {
  delete process.env[name];
}

const removeRoot = () => fs.rmSync(root, { recursive: true, force: true });
afterAll(removeRoot);
// Also when the test file fails to load and afterAll never runs.
process.once('exit', removeRoot);
