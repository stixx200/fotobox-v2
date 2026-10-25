import type { ProjectValidationIssue } from '@fotobox/collage-editor/browser';

export interface TranslatableText {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * The validator in `libs/collage-editor` only returns English messages (no
 * codes yet). Map the known ones to translation keys; unknown messages are
 * shown as-is via the `editor.validationRaw` passthrough key.
 */
const PATTERNS: { pattern: RegExp; key: string; params?: string[] }[] = [
  {
    pattern: /^Template must have at least one photo pane\.?$/i,
    key: 'editor.issues.noPhotoPane',
  },
  {
    pattern: /^Photo panes (\d+) and (\d+) overlap\.?$/i,
    key: 'editor.issues.photoOverlap',
    params: ['a', 'b'],
  },
  {
    pattern: /^A photo pane extends outside the safe area\.?$/i,
    key: 'editor.issues.outsideSafeArea',
  },
  {
    pattern: /^A layer extends outside the canvas bounds\.?$/i,
    key: 'editor.issues.outsideCanvas',
  },
];

export function validationIssueText(
  issue: Pick<ProjectValidationIssue, 'message'>,
): TranslatableText {
  for (const { pattern, key, params } of PATTERNS) {
    const match = issue.message.match(pattern);
    if (match) {
      const values: Record<string, unknown> = {};
      params?.forEach((name, index) => (values[name] = match[index + 1]));
      return { key, params: values };
    }
  }
  return { key: 'editor.validationRaw', params: { message: issue.message } };
}
