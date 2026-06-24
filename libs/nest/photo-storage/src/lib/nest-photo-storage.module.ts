import { Module } from '@nestjs/common';
import { DatabaseModule } from '@fotobox/nest-database';
import { SettingsModule } from '@fotobox/nest-settings';
import { PhotoStorageProviderService } from './photo-storage-provider.service';
import { PhotoStorageResolver } from './photo-storage.resolver';
import { PhotosController } from './photos.controller';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [PhotosController],
  providers: [PhotoStorageProviderService, PhotoStorageResolver],
  exports: [PhotoStorageProviderService],
})
export class NestPhotoStorageModule {}
