import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Observable, Subject } from 'rxjs';
import { getLogger } from '@fotobox/logging';
import { DRIZZLE, settings, type DrizzleDb } from '@fotobox/nest-database';
import { Setting, SettingInput } from './models/settings.model';

const logger = getLogger('SettingsService');

/** Hash of the last applied provisioning file (see applyProvisionedSettings). */
export const PROVISIONED_HASH_KEY = 'provisionedSettingsHash';

@Injectable()
export class SettingsService implements OnModuleInit {
  private settings: Map<string, Setting> = new Map();
  private readonly changes = new Subject<Setting[]>();

  /** Settings written via updateSetting(s) or reloaded by resetSettings(). */
  readonly changes$: Observable<Setting[]> = this.changes.asObservable();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async onModuleInit(): Promise<void> {
    await this.loadSettings();
    this.applyProvisionedSettings(process.env['FOTOBOX_SETTINGS_SEED']);
  }

  /**
   * Settings provisioned by the Windows setup script
   * (scripts/windows/provision-fotobox.ps1 writes `provisioning.json`, the
   * desktop host passes its path as FOTOBOX_SETTINGS_SEED). They are applied
   * once per file content: re-running the script with other values applies
   * them again, while changes the operator makes in the app are kept.
   * Format: `{ "settings": { "<key>": <plain JSON value>, … } }`.
   */
  applyProvisionedSettings(path: string | undefined): void {
    if (!path || !existsSync(path)) {
      return;
    }
    let content: string;
    let provisioned: unknown;
    try {
      // Tolerate a UTF-8 BOM (Windows PowerShell 5 writes one).
      content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
      provisioned = (JSON.parse(content) as { settings?: unknown }).settings;
    } catch (error) {
      logger.error(`Ignoring unreadable provisioning file ${path}`, error);
      return;
    }
    if (!provisioned || typeof provisioned !== 'object') {
      logger.warn(`No "settings" object in ${path}`);
      return;
    }
    const hash = createHash('sha256').update(content).digest('hex');
    if (this.settings.get(PROVISIONED_HASH_KEY)?.value === hash) {
      return;
    }
    const entries = Object.entries(provisioned as Record<string, unknown>);
    for (const [key, value] of entries) {
      this.storeLoaded({ key, value: JSON.stringify(value ?? null) });
    }
    this.storeLoaded({ key: PROVISIONED_HASH_KEY, value: hash });
    logger.info(`Applied ${entries.length} provisioned settings from ${path}`);
  }

  private storeLoaded(input: SettingInput): void {
    const setting: Setting = {
      ...input,
      description: this.settings.get(input.key)?.description,
    };
    this.settings.set(input.key, setting);
    this.upsertSetting(setting);
  }

  private async loadSettings(): Promise<void> {
    const rows = this.db.select().from(settings).all();
    this.settings.clear();
    for (const row of rows) {
      this.settings.set(row.key, {
        key: row.key,
        value: row.value,
        description: row.description ?? undefined,
      });
    }
    logger.info(`Loaded ${rows.length} settings from database`);
  }

  private upsertSetting(setting: Setting): void {
    const now = new Date().toISOString();
    this.db
      .insert(settings)
      .values({
        key: setting.key,
        value: setting.value,
        description: setting.description ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: setting.value,
          description: setting.description ?? null,
          updatedAt: now,
        },
      })
      .run();
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  /**
   * Read a setting value parsed from its JSON-encoded storage format.
   * Returns `fallback` when the key is missing or the value is malformed.
   */
  async getParsed<T>(key: string, fallback: T): Promise<T> {
    const setting = await this.getSetting(key);
    if (!setting?.value) {
      return fallback;
    }
    try {
      return JSON.parse(setting.value) as T;
    } catch (error) {
      logger.warn(`Failed to parse setting "${key}", using fallback`, error);
      return fallback;
    }
  }

  async updateSetting(input: SettingInput): Promise<Setting> {
    const existing = this.settings.get(input.key);
    const setting: Setting = {
      key: input.key,
      value: input.value,
      description: existing?.description,
    };

    this.settings.set(input.key, setting);
    this.upsertSetting(setting);
    logger.info(`Updated setting: ${input.key}`);
    this.changes.next([setting]);

    return setting;
  }

  async updateSettings(inputs: SettingInput[]): Promise<Setting[]> {
    const updatedSettings: Setting[] = [];

    for (const input of inputs) {
      const existing = this.settings.get(input.key);
      const setting: Setting = {
        key: input.key,
        value: input.value,
        description: existing?.description,
      };
      this.settings.set(input.key, setting);
      this.upsertSetting(setting);
      updatedSettings.push(setting);
    }

    logger.info(`Updated ${inputs.length} settings`);
    this.changes.next(updatedSettings);

    return updatedSettings;
  }

  async resetSettings(): Promise<boolean> {
    this.settings.clear();
    await this.loadSettings();
    logger.info('Settings reloaded from database');
    this.changes.next(Array.from(this.settings.values()));
    return true;
  }
}
