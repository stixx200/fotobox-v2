import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
