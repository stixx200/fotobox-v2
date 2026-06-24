import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveWorkspaceRoot } from '@fotobox/workspace-paths';

/** Resolve Drizzle SQL migrations for dev, webpack bundle, and Electron. */
export function getMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, '..', 'drizzle'),
    path.join(__dirname, 'drizzle'),
    path.join(resolveWorkspaceRoot(), 'libs/nest/database/drizzle'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}
