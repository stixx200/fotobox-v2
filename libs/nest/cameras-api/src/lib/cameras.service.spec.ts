import { describe, expect, it, vi } from 'vitest';
import { PubSub } from 'graphql-subscriptions';
import { Subject } from 'rxjs';
import {
  CameraService,
  createPhotoId,
  decodeJpegPicture,
} from './cameras.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const JPEG_BASE64 = JPEG.toString('base64');

function createService() {
  const photoStorage = {
    savePhoto: vi.fn((id: string) => `/photos/${id}.jpg`),
  };
  const service = new CameraService(photoStorage as never, new PubSub());
  const pictures = new Subject<string>();
  const camera = {
    driver: 'fake',
    observePictures: () => pictures.asObservable(),
    takePicture: vi.fn(async () => undefined),
    deinit: vi.fn(async () => undefined),
    stopLiveView: vi.fn(async () => undefined),
  };
  (service as unknown as { currentCamera: unknown }).currentCamera = camera;
  service.startPictureTakenBroadcast('fake');
  return { service, camera, pictures, photoStorage };
}

describe('decodeJpegPicture', () => {
  it('accepts raw base64 and data URLs', () => {
    expect(decodeJpegPicture(JPEG_BASE64)).toEqual(JPEG);
    expect(decodeJpegPicture(`data:image/jpeg;base64,${JPEG_BASE64}`)).toEqual(
      JPEG,
    );
    expect(
      decodeJpegPicture(`${JPEG_BASE64.slice(0, 4)}\n${JPEG_BASE64.slice(4)}`),
    ).toEqual(JPEG);
  });

  it('rejects non-JPEG and non-base64 data', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    expect(() => decodeJpegPicture(png)).toThrow(/not a JPEG/);
    expect(() => decodeJpegPicture('/tmp/photo.jpg')).toThrow(/base64/);
    expect(() => decodeJpegPicture('')).toThrow(/base64/);
  });
});

describe('createPhotoId', () => {
  it('stays unique within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createPhotoId(1)));
    expect(ids.size).toBe(50);
    expect([...ids][0]).toMatch(/^photo-1-[0-9a-f]{6}$/);
  });
});

describe('CameraService.takePictureAndWait', () => {
  it('resolves with the camera picture, not a concurrent upload', async () => {
    const { service, camera, pictures } = createService();
    camera.takePicture.mockImplementation(async () => {
      service.uploadAndBroadcastPhoto(JPEG_BASE64);
      pictures.next(JPEG_BASE64);
    });

    const uploads: string[] = [];
    service.getPictureReady$().subscribe((p) => uploads.push(p.id));

    const picture = await service.takePictureAndWait();
    expect(uploads).toHaveLength(2);
    expect(picture.id).toBe(uploads[1]);
  });

  it('rejects overlapping captures', async () => {
    const { service, pictures } = createService();
    const first = service.takePictureAndWait();
    await expect(service.takePictureAndWait()).rejects.toThrow(/already/);
    pictures.next(JPEG_BASE64);
    await expect(first).resolves.toMatchObject({ path: expect.any(String) });
  });

  it('keeps the picture stream alive after a bad picture', async () => {
    const { service, pictures } = createService();
    const first = service.takePictureAndWait();
    pictures.next('not-a-picture!');
    pictures.next(JPEG_BASE64);
    await expect(first).resolves.toBeDefined();
  });
});
