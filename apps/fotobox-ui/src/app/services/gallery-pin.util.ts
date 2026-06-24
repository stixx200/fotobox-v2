export const GALLERY_LENGTH = 4;

const GALLERY_PATTERN = /^\d{4}$/;

export function sanitizeGalleryPinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, GALLERY_LENGTH);
}

export function isGalleryPin(value: string): boolean {
  return GALLERY_PATTERN.test(value);
}

/** Empty (open access) or exactly four digits. */
export function isOptionalGalleryPin(value: string): boolean {
  return value === '' || isGalleryPin(value);
}
