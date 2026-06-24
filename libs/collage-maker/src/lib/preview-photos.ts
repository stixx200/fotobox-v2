export const PREVIEW_PHOTO_FILENAMES = [
  'preview-1.jpg',
  'preview-2.jpg',
  'preview-3.jpg',
  'preview-4.jpg',
  'preview-5.jpg',
  'preview-6.jpg',
] as const;

/** Filenames (relative to collage-maker images dir) for N photo slots, cycling when needed. */
export function previewPhotoNamesForSlots(slotCount: number): string[] {
  if (slotCount <= 0) {
    return [];
  }
  return Array.from(
    { length: slotCount },
    (_, index) =>
      PREVIEW_PHOTO_FILENAMES[index % PREVIEW_PHOTO_FILENAMES.length],
  );
}
