/** All PINs (gallery, operator) are exactly four digits. */
export const PIN_LENGTH = 4;

const PIN_PATTERN = /^\d{4}$/;

/** Strip non-digits and cap at {@link PIN_LENGTH}. */
export function sanitizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export function isPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

/** Empty (no PIN, open access) or exactly four digits. */
export function isOptionalPin(value: string): boolean {
  return value === '' || isPin(value);
}
