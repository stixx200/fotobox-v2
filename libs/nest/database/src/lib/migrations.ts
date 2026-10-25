import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveWorkspaceRoot } from '@fotobox/workspace-paths';

/**
 * Drizzle (1.0) migrations: one folder per migration containing
 * `migration.sql`. The old `meta/_journal.json` layout no longer exists.
 */
export function isMigrationsFolder(candidate: string): boolean {
  try {
    return fs
      .readdirSync(candidate, { withFileTypes: true })
      .some(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(candidate, entry.name, 'migration.sql')),
      );
  } catch {
    return false;
  }
}

/**
 * Resolve Drizzle SQL migrations next to the API bundle (desktop sidecar,
 * dist builds) or in the workspace source tree (dev, tests).
 */
export function getMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, '..', 'drizzle'),
    path.join(__dirname, 'drizzle'),
    path.join(resolveWorkspaceRoot(), 'libs/nest/database/drizzle'),
  ];
  return (
    candidates.find(isMigrationsFolder) ?? candidates[candidates.length - 1]
  );
}
