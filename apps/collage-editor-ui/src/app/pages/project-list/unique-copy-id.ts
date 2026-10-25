/**
 * Template id for a duplicate: `<id>-kopie`, `<id>-kopie-2`, … – the first one
 * not used yet. Readable ids matter because they become folder names.
 */
export function uniqueCopyId(
  id: string,
  existingIds: Iterable<string>,
): string {
  const taken = new Set(existingIds);
  const base = `${id}-kopie`;
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
