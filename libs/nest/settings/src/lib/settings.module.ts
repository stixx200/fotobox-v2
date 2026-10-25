import { Module } from '@nestjs/common';
import { DatabaseModule } from '@fotobox/nest-database';
import { SettingsService } from './settings.service';
import { SettingsResolver } from './settings.resolver';
import { DirectoryBrowserService } from './directory-browser.service';
import { DirectoryBrowserResolver } from './directory-browser.resolver';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [
    SettingsService,
    SettingsResolver,
    DirectoryBrowserService,
    DirectoryBrowserResolver,
  ],
  exports: [SettingsService, SettingsResolver],
})
export class SettingsModule {}
