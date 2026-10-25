import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getMigrationsFolder, isMigrationsFolder } from './migrations';

describe('migrations folder', () => {
  const dirs: string[] = [];
  const tempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-migrations-'));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recognises the drizzle 1.0 folder-per-migration layout', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, '20250615120000_initial'));
    fs.writeFileSync(
      path.join(dir, '20250615120000_initial', 'migration.sql'),
      '',
    );
    expect(isMigrationsFolder(dir)).toBe(true);
  });

  it('rejects empty or missing folders', () => {
    expect(isMigrationsFolder(tempDir())).toBe(false);
    expect(isMigrationsFolder('/does/not/exist')).toBe(false);
  });

  it('finds the workspace migrations', () => {
    expect(isMigrationsFolder(getMigrationsFolder())).toBe(true);
  });
});
