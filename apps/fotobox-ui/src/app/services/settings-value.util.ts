import { Setting } from './settings.service';

/** JSON-decoded value of a setting; `undefined` when missing or malformed. */
export function readSettingValue(
  settings: readonly Setting[],
  key: string,
): unknown {
  const setting = settings.find((s) => s.key === key);
  if (!setting) {
    return undefined;
  }
  try {
    return JSON.parse(setting.value);
  } catch {
    return undefined;
  }
}

export function readStringSetting(
  settings: readonly Setting[],
  key: string,
): string {
  const value = readSettingValue(settings, key);
  return typeof value === 'string' ? value : '';
}

/** `true` only when the stored value is literally `true`. */
export function readBooleanSetting(
  settings: readonly Setting[],
  key: string,
): boolean {
  return readSettingValue(settings, key) === true;
}
