const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

/**
 * Folder-safe template id from a display name: lower case, umlauts spelled
 * out, everything else non-alphanumeric collapsed to `-`.
 */
export function templateIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** True for ids the API accepts as a single folder name. */
export function isValidTemplateId(id: string): boolean {
  const trimmed = id.trim();
  return (
    trimmed.length > 0 &&
    trimmed === id &&
    trimmed !== '.' &&
    trimmed !== '..' &&
    // eslint-disable-next-line no-control-regex
    !/[\\/\u0000-\u001f]/.test(trimmed)
  );
}
