import { isValidTemplateId, templateIdFromName } from './template-id';

describe('templateIdFromName', () => {
  it('creates a readable folder name', () => {
    expect(templateIdFromName('Hochzeit Müller & Söhne 2026')).toBe(
      'hochzeit-mueller-soehne-2026',
    );
  });

  it('strips accents and edge separators', () => {
    expect(templateIdFromName('  Café Crème! ')).toBe('cafe-creme');
  });
});

describe('isValidTemplateId', () => {
  it('accepts simple ids and rejects paths', () => {
    expect(isValidTemplateId('my-template_2')).toBe(true);
    expect(isValidTemplateId('../etc')).toBe(false);
    expect(isValidTemplateId('a/b')).toBe(false);
    expect(isValidTemplateId('')).toBe(false);
  });
});
