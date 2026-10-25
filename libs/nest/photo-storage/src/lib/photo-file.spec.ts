import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { photoContentType, resolvePhotoPath } from './photo-file';

describe('resolvePhotoPath', () => {
  const root = path.resolve('/data/photos');

  it('resolves files inside the photo directory', () => {
    expect(resolvePhotoPath(root, 'photo-1.jpg')).toBe(
      path.join(root, 'photo-1.jpg'),
    );
  });

  it.each([
    '../secret.jpg',
    '../photos-backup/photo-1.jpg',
    '/etc/passwd',
    '',
    '.',
    'photo\0.jpg',
  ])('rejects %j', (filename) => {
    expect(() => resolvePhotoPath(root, filename)).toThrow('Photo not found');
  });
});

describe('photoContentType', () => {
  it('maps extensions to image types', () => {
    expect(photoContentType('a.JPG')).toBe('image/jpeg');
    expect(photoContentType('a.png')).toBe('image/png');
    expect(photoContentType('a.bin')).toBe('application/octet-stream');
  });
});
