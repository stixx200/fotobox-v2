/**
 * Default value of every setting on the settings page. Used to build the form
 * and by "Standard wiederherstellen".
 */
export const DEFAULT_SETTINGS = {
  shutterTimeout: 5,
  usePrinter: true,
  useShare: false,
  shareBaseUrl: '',
  shareTokenExpiryHours: 24,
  printerName: '',
  showPrintDialog: false,
  photoDirectory: '',
  collageDirectory: '',
  layouts: ['Einzelbild'] as string[],
  camera: '',
  galleryPassword: '',
  showGalleryButton: false,
  operatorPin: '',
  autoStart: false,
};

export type SettingsFormValue = typeof DEFAULT_SETTINGS;

export interface SettingEntry {
  key: string;
  value: string;
}

/** Settings are stored as JSON strings. */
export function encodeSetting(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Form values that differ from what is stored, as settings to save. Keys in
 * `skip` (fields that are currently invalid, e.g. a PIN with 2 of 4 digits)
 * are left out until they become valid.
 */
export function changedSettings(
  form: Record<string, unknown>,
  persisted: ReadonlyMap<string, string>,
  skip: ReadonlySet<string> = new Set(),
): SettingEntry[] {
  return Object.entries(form)
    .filter(([key]) => !skip.has(key))
    .map(([key, value]) => ({ key, value: encodeSetting(value) }))
    .filter(({ key, value }) => persisted.get(key) !== value);
}

/** Merge saved settings into the current list (saves send only changes). */
export function mergeSettings<T extends { key: string }>(
  current: readonly T[],
  updated: readonly T[],
): T[] {
  const byKey = new Map(current.map((setting) => [setting.key, setting]));
  for (const setting of updated) {
    byKey.set(setting.key, setting);
  }
  return [...byKey.values()];
}
