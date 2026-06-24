import { app, dialog, shell } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('kiosk-setup');

interface KioskConfig {
  loginItemConfigured: boolean;
  advancedSetupPrompted: boolean;
  configuredAt: string;
}

function getConfigPath(): string {
  return join(app.getPath('userData'), '.kiosk-configured.json');
}

function readConfig(): KioskConfig | null {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as KioskConfig;
  } catch {
    return null;
  }
}

function writeConfig(partial: Partial<KioskConfig>): void {
  const existing = readConfig() ?? {
    loginItemConfigured: false,
    advancedSetupPrompted: false,
    configuredAt: new Date().toISOString(),
  };
  const next: KioskConfig = {
    ...existing,
    ...partial,
    configuredAt: new Date().toISOString(),
  };
  writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8');
}

function configureLoginItem(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: [],
  });
  logger.info('Configured open-at-login for Fotobox');
  writeConfig({ loginItemConfigured: true });
}

function resolveKioskScriptPath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'setup-kiosk.ps1'),
    join(process.resourcesPath, '..', 'setup-kiosk.ps1'),
    join(app.getAppPath(), '..', 'setup-kiosk.ps1'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function promptAdvancedKioskSetup(): Promise<void> {
  const config = readConfig();
  if (config?.advancedSetupPrompted) {
    return;
  }

  const scriptPath = resolveKioskScriptPath();
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Later', 'Open setup guide', 'Run elevated setup'],
    defaultId: 1,
    cancelId: 0,
    title: 'Fotobox kiosk setup',
    message: 'Configure advanced Windows kiosk options?',
    detail:
      'Fotobox will start automatically after login. For full desktop lockdown (Assigned Access) or LAN firewall rules, run the bundled setup-kiosk.ps1 script.',
  });

  writeConfig({ advancedSetupPrompted: true });

  if (response === 0) {
    return;
  }

  if (!scriptPath) {
    await dialog.showMessageBox({
      type: 'warning',
      message: 'setup-kiosk.ps1 was not found in the install directory.',
    });
    return;
  }

  if (response === 1) {
    await shell.openPath(scriptPath);
    return;
  }

  if (process.platform === 'win32') {
    spawn(
      'powershell.exe',
      [
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -File "${scriptPath.replace(/"/g, '\\"')}" -Elevated'`,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
  }
}

/**
 * One-time production kiosk bootstrap: login item + optional advanced setup prompt.
 */
export async function runProductionKioskSetup(): Promise<void> {
  if (process.env.FOTOBOX_DEV_SERVER) {
    return;
  }

  const config = readConfig();
  if (!config?.loginItemConfigured) {
    configureLoginItem();
  }

  await promptAdvancedKioskSetup();
}
