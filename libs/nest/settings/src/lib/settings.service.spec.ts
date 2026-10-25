import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestDatabase } from '@fotobox/nest-database';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];
  let service: SettingsService;

  beforeEach(async () => {
    const testDb = createTestDatabase();
    sqlite = testDb.sqlite;
    service = new SettingsService(testDb.db);
    await service.onModuleInit();
  });

  afterEach(() => {
    sqlite.close();
  });

  it('stores and parses JSON settings', async () => {
    await service.updateSetting({
      key: 'layouts',
      value: JSON.stringify(['collage', 'single']),
    });

    await expect(service.getParsed('layouts', [])).resolves.toEqual([
      'collage',
      'single',
    ]);
  });

  it('returns fallback when setting is missing or malformed', async () => {
    await expect(service.getParsed('missing', ['default'])).resolves.toEqual([
      'default',
    ]);

    await service.updateSetting({ key: 'broken', value: 'not-json' });
    await expect(service.getParsed('broken', 42)).resolves.toBe(42);
  });

  it('persists settings across reload', async () => {
    const testDb = createTestDatabase();
    const first = new SettingsService(testDb.db);
    await first.onModuleInit();

    await first.updateSetting({
      key: 'camera',
      value: JSON.stringify('demo'),
    });

    const reloaded = new SettingsService(testDb.db);
    await reloaded.onModuleInit();

    await expect(reloaded.getParsed('camera', '')).resolves.toBe('demo');
    testDb.sqlite.close();
  });

  describe('provisioned settings', () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'fotobox-provisioning-'));
      file = join(dir, 'provisioning.json');
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    function provision(settings: Record<string, unknown>): void {
      // With a BOM, as Windows PowerShell 5 writes it.
      writeFileSync(file, '\uFEFF' + JSON.stringify({ settings }));
    }

    it('applies the file once and keeps later changes', async () => {
      provision({ photoDirectory: 'D:\\Fotos', usePrinter: false });
      service.applyProvisionedSettings(file);
      await expect(service.getParsed('photoDirectory', '')).resolves.toBe(
        'D:\\Fotos',
      );
      await expect(service.getParsed('usePrinter', true)).resolves.toBe(false);

      await service.updateSetting({
        key: 'photoDirectory',
        value: JSON.stringify('E:\\Other'),
      });
      service.applyProvisionedSettings(file);
      await expect(service.getParsed('photoDirectory', '')).resolves.toBe(
        'E:\\Other',
      );
    });

    it('applies a changed file again', async () => {
      provision({ shutterTimeout: 3 });
      service.applyProvisionedSettings(file);
      await service.updateSetting({ key: 'shutterTimeout', value: '8' });

      provision({ shutterTimeout: 4 });
      service.applyProvisionedSettings(file);
      await expect(service.getParsed('shutterTimeout', 0)).resolves.toBe(4);
    });

    it('ignores a missing or invalid file', async () => {
      service.applyProvisionedSettings(join(dir, 'missing.json'));
      writeFileSync(file, '{ not json');
      service.applyProvisionedSettings(file);
      await expect(service.getAllSettings()).resolves.toEqual([]);
    });
  });
});
