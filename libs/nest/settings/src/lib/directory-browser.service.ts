import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DirectoryEntry,
  DirectoryListing,
} from './models/directory-listing.model';

/** Windows system folders that are never useful as a photo/template folder. */
const HIDDEN_NAMES = new Set(['$recycle.bin', 'system volume information']);

function isVisibleName(name: string): boolean {
  return !name.startsWith('.') && !HIDDEN_NAMES.has(name.toLowerCase());
}

function isDirectory(fullPath: string): boolean {
  try {
    return fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Lists folders on the host so the settings screen can offer a folder picker
 * in any browser (a web page cannot browse the host's filesystem itself).
 * Only directories are listed; the API access policy limits callers to the
 * host itself or token-authenticated tablets.
 */
@Injectable()
export class DirectoryBrowserService {
  /** Overridable in tests. */
  platform: NodeJS.Platform = process.platform;
  homeDir: string = os.homedir();

  browse(requestedPath?: string | null): DirectoryListing {
    const target = this.nearestExistingDirectory(
      requestedPath?.trim() ? path.resolve(requestedPath.trim()) : this.homeDir,
    );
    const parent = path.dirname(target);

    return {
      path: target,
      parent: parent === target ? null : parent,
      entries: this.listSubdirectories(target),
      roots: this.roots(),
    };
  }

  /** A configured folder may not exist (yet): show its closest existing ancestor. */
  private nearestExistingDirectory(start: string): string {
    let current = start;
    while (!isDirectory(current)) {
      const parent = path.dirname(current);
      if (parent === current) {
        return this.homeDir;
      }
      current = parent;
    }
    return current;
  }

  private listSubdirectories(directory: string): DirectoryEntry[] {
    let names: string[];
    try {
      names = fs.readdirSync(directory);
    } catch {
      return [];
    }
    return names
      .filter(isVisibleName)
      .map((name) => ({ name, path: path.join(directory, name) }))
      .filter((entry) => isDirectory(entry.path))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
  }

  private roots(): string[] {
    if (this.platform === 'win32') {
      const drives = Array.from(
        { length: 26 },
        (_, i) => `${String.fromCharCode(65 + i)}:\\`,
      ).filter(isDirectory);
      return [this.homeDir, ...drives];
    }
    return [this.homeDir, '/'];
  }
}
