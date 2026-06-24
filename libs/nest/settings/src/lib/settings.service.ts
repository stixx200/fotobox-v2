import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { DRIZZLE, settings, type DrizzleDb } from '@fotobox/nest-database';
import { Setting, SettingInput } from './models/settings.model';

const logger = getLogger('SettingsService');

@Injectable()
export class SettingsService implements OnModuleInit {
  private settings: Map<string, Setting> = new Map();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async onModuleInit(): Promise<void> {
    await this.loadSettings();
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

    return updatedSettings;
  }

  async resetSettings(): Promise<boolean> {
    this.settings.clear();
    await this.loadSettings();
    logger.info('Settings reloaded from database');
    return true;
  }
}
