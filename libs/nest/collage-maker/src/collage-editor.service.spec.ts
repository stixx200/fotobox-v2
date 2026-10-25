import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CollageEditorService,
  resolveTemplateFolder,
} from './collage-editor.service';

describe('resolveTemplateFolder', () => {
  const root = path.resolve('/srv/templates');

  it('accepts plain template ids', () => {
    expect(resolveTemplateFolder(root, 'wedding')).toBe(
      path.join(root, 'wedding'),
    );
    expect(resolveTemplateFolder(root, 'Einzelbild 2')).toBe(
      path.join(root, 'Einzelbild 2'),
    );
  });

  it.each(['', '.', '..', '../etc', 'a/../../b', 'a/b', '/etc', 'a\0b'])(
    'rejects %j',
    (id) => {
      expect(() => resolveTemplateFolder(root, id)).toThrow(
        /Invalid template id/,
      );
    },
  );
});

describe('CollageEditorService path safety', () => {
  let workDir: string;
  let templateDir: string;
  let service: CollageEditorService;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collage-editor-'));
    templateDir = path.join(workDir, 'templates');
    fs.mkdirSync(path.join(templateDir, 'keep'), { recursive: true });
    fs.mkdirSync(path.join(workDir, 'victim'));
    service = new CollageEditorService({
      get: () => undefined,
    } as never);
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('refuses to delete outside the template directory', () => {
    expect(() => service.deleteProject('../victim', templateDir)).toThrow(
      /Invalid template id/,
    );
    expect(fs.existsSync(path.join(workDir, 'victim'))).toBe(true);
  });

  it('refuses relative collage directories', () => {
    expect(() => service.deleteProject('keep', 'templates')).toThrow(
      /absolute path/,
    );
  });

  it('deletes templates inside the directory', () => {
    expect(service.deleteProject('keep', templateDir)).toEqual({
      templateId: 'keep',
    });
    expect(fs.existsSync(path.join(templateDir, 'keep'))).toBe(false);
  });
});
