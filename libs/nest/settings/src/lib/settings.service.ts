import { Injectable } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { Setting, SettingInput } from './models/settings.model';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

const logger = getLogger('SettingsService');

@Injectable()
export class SettingsService {
  private settings: Map<string, Setting> = new Map();
  private settingsFilePath: string;

  constructor() {
    // Store settings in userData directory
    const userDataPath = app?.getPath('userData') || process.cwd();
    this.settingsFilePath = path.join(userDataPath, 'settings.json');
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await fs.readFile(this.settingsFilePath, 'utf-8');
      const settingsArray: Setting[] = JSON.parse(data);
      settingsArray.forEach(setting => {
        this.settings.set(setting.key, setting);
      });
      logger.info(`Loaded ${settingsArray.length} settings from file`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('Settings file not found, starting with empty settings');
        await this.saveSettings();
      } else {
        logger.error('Error loading settings:', error);
      }
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const settingsArray = Array.from(this.settings.values());
      await fs.writeFile(
        this.settingsFilePath,
        JSON.stringify(settingsArray, null, 2),
        'utf-8'
      );
      logger.debug('Settings saved to file');
    } catch (error) {
      logger.error('Error saving settings:', error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async updateSetting(input: SettingInput): Promise<Setting> {
    const existing = this.settings.get(input.key);
    const setting: Setting = {
      key: input.key,
      value: input.value,
      description: existing?.description,
    };
    
    this.settings.set(input.key, setting);
    await this.saveSettings();
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
      updatedSettings.push(setting);
    }
    
    await this.saveSettings();
    logger.info(`Updated ${inputs.length} settings`);
    
    return updatedSettings;
  }

  async resetSettings(): Promise<boolean> {
    this.settings.clear();
    await this.saveSettings();
    logger.info('All settings reset');
    return true;
  }
}
