import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SettingsService } from './settings.service';
import { Setting, Settings, SettingInput, SettingsInput } from './models/settings.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('SettingsResolver');

@Resolver(() => Setting)
export class SettingsResolver {
  constructor(private readonly settingsService: SettingsService) {}

  @Query(() => Settings, { description: 'Get all settings' })
  async settings(): Promise<Settings> {
    logger.debug('Fetching all settings');
    const items = await this.settingsService.getAllSettings();
    return { items };
  }

  @Query(() => Setting, { 
    nullable: true, 
    description: 'Get a specific setting by key' 
  })
  async setting(@Args('key') key: string): Promise<Setting | undefined> {
    logger.debug(`Fetching setting: ${key}`);
    return this.settingsService.getSetting(key);
  }

  @Mutation(() => Setting, { description: 'Update a single setting' })
  async updateSetting(
    @Args('input') input: SettingInput
  ): Promise<Setting> {
    logger.debug(`Updating setting: ${input.key}`);
    return this.settingsService.updateSetting(input);
  }

  @Mutation(() => [Setting], { description: 'Update multiple settings' })
  async updateSettings(
    @Args('input') input: SettingsInput
  ): Promise<Setting[]> {
    logger.debug(`Updating ${input.settings.length} settings`);
    return this.settingsService.updateSettings(input.settings);
  }

  @Mutation(() => GenericMutationResult, { description: 'Reset all settings' })
  async resetSettings(): Promise<GenericMutationResult> {
    logger.debug('Resetting all settings');
    const success = await this.settingsService.resetSettings();
    return {
      success,
      message: success ? 'All settings have been reset' : 'Failed to reset settings',
    };
  }
}
