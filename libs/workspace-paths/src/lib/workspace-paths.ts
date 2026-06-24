import * as fs from 'node:fs';
import * as path from 'node:path';

let cachedWorkspaceRoot: string | null = null;

export function resolveWorkspaceRoot(startDir = process.cwd()): string {
  if (process.env['FOTOBOX_WORKSPACE_ROOT']) {
    return path.resolve(process.env['FOTOBOX_WORKSPACE_ROOT']);
  }
  if (cachedWorkspaceRoot) {
    return cachedWorkspaceRoot;
  }

  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) {
      cachedWorkspaceRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      cachedWorkspaceRoot = startDir;
      return startDir;
    }
    dir = parent;
  }
}

export function getWorkspaceTmpDir(): string {
  return path.join(resolveWorkspaceRoot(), 'tmp');
}

export function getWorkspaceDataDir(): string {
  return path.join(getWorkspaceTmpDir(), 'runtime', 'fotobox');
}

export function getWorkspaceLogFile(): string {
  return (
    process.env['FOTOBOX_LOG_FILE'] ??
    path.join(getWorkspaceTmpDir(), 'logs', 'application.log')
  );
}

export function getDatabasePath(): string {
  if (process.env['FOTOBOX_DATABASE_PATH']) {
    const explicit = process.env['FOTOBOX_DATABASE_PATH'];
    return path.isAbsolute(explicit)
      ? explicit
      : path.resolve(process.cwd(), explicit);
  }

  const settingsPath = process.env['FOTOBOX_SETTINGS_PATH'];
  if (settingsPath) {
    const resolved = path.isAbsolute(settingsPath)
      ? settingsPath
      : path.resolve(process.cwd(), settingsPath);
    return path.join(path.dirname(resolved), 'fotobox.db');
  }

  if (isElectronRuntime()) {
    try {
      const { app } = require('electron') as {
        app?: { getPath?: (name: string) => string };
      };
      const userData = app?.getPath?.('userData');
      if (userData) {
        return path.join(userData, 'fotobox.db');
      }
    } catch {
      // fall through
    }
  }

  return path.join(getWorkspaceDataDir(), 'fotobox.db');
}

export function getShareTokensPath(): string {
  if (process.env['FOTOBOX_SHARE_TOKENS_PATH']) {
    const explicit = process.env['FOTOBOX_SHARE_TOKENS_PATH'];
    return path.isAbsolute(explicit)
      ? explicit
      : path.resolve(process.cwd(), explicit);
  }

  const settingsPath = process.env['FOTOBOX_SETTINGS_PATH'];
  if (settingsPath) {
    const resolved = path.isAbsolute(settingsPath)
      ? settingsPath
      : path.resolve(process.cwd(), settingsPath);
    return path.join(path.dirname(resolved), 'share-tokens.json');
  }

  return path.join(getWorkspaceDataDir(), 'share-tokens.json');
}

export function isElectronRuntime(): boolean {
  try {
    const { app } = require('electron') as {
      app?: { getPath?: (name: string) => string };
    };
    return !!app?.getPath;
  } catch {
    return false;
  }
}

export const workspacePaths = {
  root: resolveWorkspaceRoot,
  tmp: getWorkspaceTmpDir,
  data: getWorkspaceDataDir,
  photos: () =>
    process.env['FOTOBOX_PHOTO_DIR'] ??
    path.join(getWorkspaceDataDir(), 'photos'),
  collageTemplates: () =>
    process.env['FOTOBOX_TEMPLATE_DIR'] ??
    path.join(getWorkspaceDataDir(), 'collage-templates'),
  settings: () =>
    process.env['FOTOBOX_SETTINGS_PATH'] ??
    path.join(getWorkspaceDataDir(), 'settings.json'),
  shareTokens: getShareTokensPath,
  database: getDatabasePath,
  logs: () => path.join(getWorkspaceTmpDir(), 'logs'),
  logFile: getWorkspaceLogFile,
  playwrightReport: () =>
    path.join(getWorkspaceTmpDir(), 'playwright', 'report'),
  playwrightTestResults: () =>
    path.join(getWorkspaceTmpDir(), 'playwright', 'test-results'),
};

export function ensureWorkspaceTmpLayout(): void {
  for (const dir of [
    workspacePaths.tmp(),
    workspacePaths.data(),
    workspacePaths.photos(),
    workspacePaths.collageTemplates(),
    workspacePaths.logs(),
    workspacePaths.playwrightReport(),
    workspacePaths.playwrightTestResults(),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function migrateLegacyWorkspaceFiles(): void {
  const root = resolveWorkspaceRoot();
  const migrations: Array<{ from: string; to: string }> = [
    { from: path.join(root, 'settings.json'), to: workspacePaths.settings() },
    {
      from: path.join(root, 'share-tokens.json'),
      to: workspacePaths.shareTokens(),
    },
    {
      from: path.join(root, 'application.log'),
      to: workspacePaths.logFile(),
    },
  ];

  for (const { from, to } of migrations) {
    if (!fs.existsSync(from) || fs.existsSync(to)) {
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }

  const legacyTemplateDir = path.join(root, 'collage-templates');
  const targetTemplateDir = workspacePaths.collageTemplates();
  if (
    fs.existsSync(legacyTemplateDir) &&
    legacyTemplateDir !== targetTemplateDir
  ) {
    fs.mkdirSync(targetTemplateDir, { recursive: true });
    for (const entry of fs.readdirSync(legacyTemplateDir)) {
      const source = path.join(legacyTemplateDir, entry);
      const target = path.join(targetTemplateDir, entry);
      if (!fs.existsSync(target)) {
        fs.cpSync(source, target, { recursive: true });
      }
    }
  }

  const legacyPhotosDir = path.join(root, 'photos');
  const targetPhotosDir = workspacePaths.photos();
  if (fs.existsSync(legacyPhotosDir) && legacyPhotosDir !== targetPhotosDir) {
    fs.mkdirSync(targetPhotosDir, { recursive: true });
    for (const entry of fs.readdirSync(legacyPhotosDir)) {
      const source = path.join(legacyPhotosDir, entry);
      const target = path.join(targetPhotosDir, entry);
      if (!fs.existsSync(target)) {
        fs.cpSync(source, target, { recursive: true });
      }
    }
  }
}

/** Apply tmp defaults for standalone API / dev unless explicitly overridden. */
export function applyDefaultWorkspaceEnv(): void {
  ensureWorkspaceTmpLayout();
  migrateLegacyWorkspaceFiles();

  if (!process.env['FOTOBOX_PHOTO_DIR']) {
    process.env['FOTOBOX_PHOTO_DIR'] = workspacePaths.photos();
  }
  if (!process.env['FOTOBOX_TEMPLATE_DIR']) {
    process.env['FOTOBOX_TEMPLATE_DIR'] = workspacePaths.collageTemplates();
  }
  if (!process.env['FOTOBOX_LOG_FILE']) {
    process.env['FOTOBOX_LOG_FILE'] = workspacePaths.logFile();
  }
  if (!process.env['FOTOBOX_SETTINGS_PATH'] && !isElectronRuntime()) {
    process.env['FOTOBOX_SETTINGS_PATH'] = workspacePaths.settings();
  }
}
