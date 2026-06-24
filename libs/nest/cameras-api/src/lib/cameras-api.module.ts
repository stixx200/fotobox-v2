import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { CameraService } from './cameras.service';
import { CameraResolver } from './cameras.resolver';

@Module({
  imports: [NestPhotoStorageModule],
  controllers: [],
  providers: [
    CameraService,
    CameraResolver,
    {
      provide: PubSub,
      useValue: new PubSub(),
    },
  ],
  exports: [CameraService, CameraResolver],
})
export class CamerasApiModule {}
