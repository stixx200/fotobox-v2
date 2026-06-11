import { Module } from '@nestjs/common';
import { PhotoStorageProviderService } from './photo-storage-provider.service';
import { PhotoStorageResolver } from './photo-storage.resolver';

@Module({
  controllers: [],
  providers: [PhotoStorageProviderService, PhotoStorageResolver],
  exports: [PhotoStorageProviderService],
})
export class NestPhotoStorageModule {}
