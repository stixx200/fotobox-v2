import { Module } from '@nestjs/common';
import { DatabaseModule } from '@fotobox/nest-database';
import { SettingsService } from './settings.service';
import { SettingsResolver } from './settings.resolver';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [SettingsService, SettingsResolver],
  exports: [SettingsService, SettingsResolver],
})
export class SettingsModule {}
