export const GALLERY_PIN_LENGTH = 4;

const GALLERY_PIN_PATTERN = /^\d{4}$/;

export function sanitizeGalleryPinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, GALLERY_PIN_LENGTH);
}

export function isGalleryPin(value: string): boolean {
  return GALLERY_PIN_PATTERN.test(value);
}

/** Empty (open access) or exactly four digits. */
export function isOptionalGalleryPin(value: string): boolean {
  return value === '' || isGalleryPin(value);
}
