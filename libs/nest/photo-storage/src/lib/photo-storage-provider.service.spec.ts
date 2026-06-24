import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, PhotoRepository } from '@fotobox/nest-database';
import { PhotoStorageService } from '@fotobox/photo-storage';
import { PhotoStorageProviderService } from './photo-storage-provider.service';

describe('PhotoStorageProviderService', () => {
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];
  let photoDir: string;
  let service: PhotoStorageProviderService;

  beforeEach(() => {
    const testDb = createTestDatabase();
    sqlite = testDb.sqlite;
    photoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-photos-'));

    PhotoStorageService.reset();
    const photoStorage = PhotoStorageService.getInstance({
      photoDirectory: photoDir,
    });

    const settingsService = {
      getParsed: vi.fn().mockResolvedValue(null),
    };

    service = new PhotoStorageProviderService(
      settingsService as never,
      new PhotoRepository(testDb.db),
    );
    (service as { photoStorageService: PhotoStorageService }).photoStorageService =
      photoStorage;
  });

  afterEach(() => {
    PhotoStorageService.reset();
    sqlite.close();
    fs.rmSync(photoDir, { recursive: true, force: true });
  });

  it('syncs save, list, and delete between filesystem and database', () => {
    service.savePhoto('photo-1', Buffer.from('jpeg'));

    expect(fs.existsSync(path.join(photoDir, 'photo-1.jpg'))).toBe(true);
    expect(service.listPhotos()).toEqual([
      expect.objectContaining({
        id: 'photo-1',
        path: '/api/photos/photo-1.jpg',
      }),
    ]);
    expect(service.photoExists('photo-1')).toBe(true);

    service.deletePhoto('photo-1');
    expect(service.listPhotos()).toHaveLength(0);
    expect(fs.existsSync(path.join(photoDir, 'photo-1.jpg'))).toBe(false);
  });
});
