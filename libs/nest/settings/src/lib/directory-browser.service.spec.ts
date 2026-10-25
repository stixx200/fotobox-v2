import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DirectoryBrowserService } from './directory-browser.service';

describe('DirectoryBrowserService', () => {
  let root: string;
  let service: DirectoryBrowserService;

  beforeEach(() => {
    root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'fotobox-browse-')),
    );
    fs.mkdirSync(path.join(root, 'photos'));
    fs.mkdirSync(path.join(root, 'Collages'));
    fs.mkdirSync(path.join(root, '.hidden'));
    fs.writeFileSync(path.join(root, 'notes.txt'), 'not a folder');
    service = new DirectoryBrowserService();
    service.homeDir = root;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists visible subfolders only, sorted case-insensitively', () => {
    const listing = service.browse(root);
    expect(listing.path).toBe(root);
    expect(listing.entries).toEqual([
      { name: 'Collages', path: path.join(root, 'Collages') },
      { name: 'photos', path: path.join(root, 'photos') },
    ]);
    expect(listing.parent).toBe(path.dirname(root));
  });

  it('defaults to the home directory', () => {
    expect(service.browse().path).toBe(root);
    expect(service.browse('  ').path).toBe(root);
  });

  it('falls back to the nearest existing ancestor', () => {
    const listing = service.browse(path.join(root, 'photos', 'not', 'yet'));
    expect(listing.path).toBe(path.join(root, 'photos'));
  });

  it('has no parent at the filesystem root', () => {
    expect(service.browse(path.parse(root).root).parent).toBeNull();
  });

  it('offers home and / as roots on macOS/Linux', () => {
    service.platform = 'darwin';
    expect(service.browse(root).roots).toEqual([root, '/']);
  });
});
