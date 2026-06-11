import { Module } from '@nestjs/common';
import { CollageMakerService } from './collage-maker.service';
import { CollageMakerResolver } from './collage-maker.resolver';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '@fotobox/nest-settings';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';

@Module({
  imports: [ConfigModule, SettingsModule, NestPhotoStorageModule],
  providers: [CollageMakerService, CollageMakerResolver],
  exports: [CollageMakerService, CollageMakerResolver],
})
export class CollageMakerModule {}
