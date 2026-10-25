import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startApi, testDirs, type TestApi } from './support/test-app';

interface SettingItem {
  key: string;
  value: string;
}

const SETTINGS_QUERY = /* GraphQL */ `
  query {
    settings {
      items {
        key
        value
      }
    }
  }
`;

const UPDATE_SETTINGS = /* GraphQL */ `
  mutation ($input: SettingsInput!) {
    updateSettings(input: $input) {
      key
      value
    }
  }
`;

function asMap(items: SettingItem[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.key, item.value]));
}

describe('settings', () => {
  let api: TestApi | undefined;

  afterEach(async () => {
    await api?.close();
    api = undefined;
  });

  it('updateSettings saves only the given keys and returns them', async () => {
    api = await startApi();
    await api.gqlOk(UPDATE_SETTINGS, {
      input: {
        settings: [
          { key: 'it.keep', value: '"untouched"' },
          { key: 'it.change', value: '1' },
        ],
      },
    });

    const { updateSettings } = await api.gqlOk<{
      updateSettings: SettingItem[];
    }>(UPDATE_SETTINGS, {
      input: { settings: [{ key: 'it.change', value: '2' }] },
    });

    expect(updateSettings).toEqual([{ key: 'it.change', value: '2' }]);
    const { settings } = await api.gqlOk<{
      settings: { items: SettingItem[] };
    }>(SETTINGS_QUERY);
    expect(asMap(settings.items)).toMatchObject({
      'it.keep': '"untouched"',
      'it.change': '2',
    });
  });

  it('persists settings across an app restart on the same data dir', async () => {
    api = await startApi();
    await api.gqlOk(UPDATE_SETTINGS, {
      input: {
        settings: [
          { key: 'it.persisted', value: '{"a":[1,2,3]}' },
          { key: 'useShare', value: 'true' },
        ],
      },
    });
    await api.close();

    api = await startApi();
    const { setting } = await api.gqlOk<{ setting: SettingItem | null }>(
      /* GraphQL */ `
        query {
          setting(key: "it.persisted") {
            key
            value
          }
        }
      `,
    );
    expect(setting).toEqual({ key: 'it.persisted', value: '{"a":[1,2,3]}' });
    expect(fs.existsSync(process.env['FOTOBOX_DATABASE_PATH'] as string)).toBe(
      true,
    );
  });

  it('browseDirectory lists the subfolders of the temp dir', async () => {
    api = await startApi();
    const dir = path.join(testDirs.root, 'browse');
    fs.mkdirSync(path.join(dir, 'Beta'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'alpha'));
    fs.mkdirSync(path.join(dir, '.hidden'));
    fs.writeFileSync(path.join(dir, 'file.txt'), 'not a folder');

    const { browseDirectory } = await api.gqlOk<{
      browseDirectory: {
        path: string;
        parent: string | null;
        entries: { name: string; path: string }[];
        roots: string[];
      };
    }>(
      /* GraphQL */ `
        query ($path: String) {
          browseDirectory(path: $path) {
            path
            parent
            entries {
              name
              path
            }
            roots
          }
        }
      `,
      { path: dir },
    );

    expect(browseDirectory.path).toBe(dir);
    expect(browseDirectory.parent).toBe(testDirs.root);
    expect(browseDirectory.entries).toEqual([
      { name: 'alpha', path: path.join(dir, 'alpha') },
      { name: 'Beta', path: path.join(dir, 'Beta') },
    ]);
    expect(browseDirectory.roots.length).toBeGreaterThan(0);
  });

  it('browseDirectory falls back to the nearest existing parent', async () => {
    api = await startApi();
    const dir = path.join(testDirs.root, 'browse-missing');
    fs.mkdirSync(path.join(dir, 'child'), { recursive: true });

    const { browseDirectory } = await api.gqlOk<{
      browseDirectory: { path: string; entries: { name: string }[] };
    }>(
      /* GraphQL */ `
        query ($path: String) {
          browseDirectory(path: $path) {
            path
            entries {
              name
            }
          }
        }
      `,
      { path: path.join(dir, 'does', 'not', 'exist') },
    );

    expect(browseDirectory.path).toBe(dir);
    expect(browseDirectory.entries.map((entry) => entry.name)).toEqual([
      'child',
    ]);
  });
});
