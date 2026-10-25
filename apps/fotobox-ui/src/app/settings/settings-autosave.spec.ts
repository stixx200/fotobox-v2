import {
  changedSettings,
  DEFAULT_SETTINGS,
  encodeSetting,
  mergeSettings,
} from './settings-autosave';

describe('settings auto-save helpers', () => {
  it('returns only changed fields, JSON-encoded', () => {
    const persisted = new Map([
      ['shutterTimeout', '5'],
      ['photoDirectory', '"/photos"'],
      ['layouts', '["Einzelbild"]'],
    ]);
    expect(
      changedSettings(
        {
          shutterTimeout: 5,
          photoDirectory: '/new',
          layouts: ['Einzelbild'],
          usePrinter: true,
        },
        persisted,
      ),
    ).toEqual([
      { key: 'photoDirectory', value: '"/new"' },
      { key: 'usePrinter', value: 'true' },
    ]);
  });

  it('skips invalid fields until they become valid', () => {
    const persisted = new Map([['operatorPin', '""']]);
    expect(
      changedSettings(
        { operatorPin: '12', autoStart: true },
        persisted,
        new Set(['operatorPin']),
      ),
    ).toEqual([{ key: 'autoStart', value: 'true' }]);
  });

  it('finds nothing to save when the form matches the stored settings', () => {
    const persisted = new Map(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [
        key,
        encodeSetting(value),
      ]),
    );
    expect(changedSettings({ ...DEFAULT_SETTINGS }, persisted)).toEqual([]);
  });

  it('merges saved settings into the full list', () => {
    const current = [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ];
    expect(
      mergeSettings(current, [
        { key: 'b', value: '3' },
        { key: 'c', value: '4' },
      ]),
    ).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '3' },
      { key: 'c', value: '4' },
    ]);
  });
});
