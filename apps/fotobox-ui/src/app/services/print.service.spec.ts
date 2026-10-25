import { photoFilenameFromUrl } from './print.service';

describe('photoFilenameFromUrl', () => {
  it('extracts the stored photo file name', () => {
    expect(
      photoFilenameFromUrl('http://localhost:3000/api/photos/photo-1.jpg'),
    ).toBe('photo-1.jpg');
    expect(
      photoFilenameFromUrl(
        'http://192.168.1.5:3000/api/photos/collage-2.jpg?token=abc',
      ),
    ).toBe('collage-2.jpg');
    expect(photoFilenameFromUrl('/api/photos/photo-3.jpg')).toBe('photo-3.jpg');
  });

  it('rejects URLs that are not stored photos', () => {
    expect(photoFilenameFromUrl('data:image/jpeg;base64,abc')).toBeNull();
    expect(photoFilenameFromUrl('http://x/api/share/token')).toBeNull();
    expect(photoFilenameFromUrl('http://x/api/photos/a/b.jpg')).toBeNull();
  });
});
