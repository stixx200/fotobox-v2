import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CollageMakerService } from './collage-maker.service';

const libRoot = path.resolve(__dirname, '../../../collage-maker/src');

describe('CollageMakerService', () => {
  let photoDir: string;
  let service: CollageMakerService;
  const photoStorage = { getPhotoDirectory: () => photoDir };

  beforeEach(() => {
    photoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-collage-'));
    const config = {
      // The startup default; the operator's setting lives in photo storage.
      getOrThrow: () => '/default/runtime/photos/that/does/not/exist',
      get: (key: string) =>
        key === 'builtInTemplateDirectory'
          ? path.join(libRoot, 'templates')
          : undefined,
    };
    service = new CollageMakerService(config as never, photoStorage as never);
  });

  afterEach(() => {
    fs.rmSync(photoDir, { recursive: true, force: true });
  });

  it('builds the collage from the photo folder set in the settings', async () => {
    fs.copyFileSync(
      path.join(libRoot, 'images', 'preview-1.jpg'),
      path.join(photoDir, 'photo-1.jpg'),
    );
    service.startCollage('2x2');
    service.addPhoto('photo-1.jpg');

    const collage = await service.createCurrentCollage();

    // JPEG magic bytes
    expect([...collage.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('follows a changed photo folder without a restart', async () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-collage-'));
    try {
      fs.copyFileSync(
        path.join(libRoot, 'images', 'preview-2.jpg'),
        path.join(otherDir, 'photo-2.jpg'),
      );
      service.startCollage('2x2');
      service.addPhoto('photo-2.jpg');
      photoDir = otherDir;

      await expect(service.createCurrentCollage()).resolves.toBeInstanceOf(
        Buffer,
      );
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });
});
