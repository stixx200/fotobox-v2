import { Module } from '@nestjs/common';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { CameraService } from './cameras.service';
import { CameraResolver } from './cameras.resolver';

@Module({
  imports: [NestPhotoStorageModule],
  controllers: [],
  providers: [CameraService, CameraResolver],
  exports: [CameraService, CameraResolver],
})
export class CamerasApiModule {}
