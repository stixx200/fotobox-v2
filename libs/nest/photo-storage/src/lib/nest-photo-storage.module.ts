import { Module } from '@nestjs/common';
import { SettingsModule } from '@fotobox/nest-settings';
import { PhotoStorageProviderService } from './photo-storage-provider.service';
import { PhotoStorageResolver } from './photo-storage.resolver';

@Module({
  imports: [SettingsModule],
  controllers: [],
  providers: [PhotoStorageProviderService, PhotoStorageResolver],
  exports: [PhotoStorageProviderService],
})
export class NestPhotoStorageModule {}
