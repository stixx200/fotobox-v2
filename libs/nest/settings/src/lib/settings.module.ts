import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsResolver } from './settings.resolver';

@Module({
  controllers: [],
  providers: [SettingsService, SettingsResolver],
  exports: [SettingsService, SettingsResolver],
})
export class SettingsModule {}
