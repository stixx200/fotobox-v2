import { Module } from '@nestjs/common';
import { CameraService } from './cameras.service';
import { CameraResolver } from './cameras.resolver';

@Module({
  controllers: [],
  providers: [CameraService, CameraResolver],
  exports: [CameraService, CameraResolver],
})
export class CamerasApiModule {}
