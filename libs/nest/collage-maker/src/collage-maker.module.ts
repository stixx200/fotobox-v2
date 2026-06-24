import { Module } from '@nestjs/common';
import { CollageMakerService } from './collage-maker.service';
import { CollageMakerResolver } from './collage-maker.resolver';
import { CollageEditorService } from './collage-editor.service';
import { CollageEditorResolver } from './collage-editor.resolver';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '@fotobox/nest-settings';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';

@Module({
  imports: [ConfigModule, SettingsModule, NestPhotoStorageModule],
  providers: [
    CollageMakerService,
    CollageMakerResolver,
    CollageEditorService,
    CollageEditorResolver,
  ],
  exports: [CollageMakerService, CollageEditorService],
})
export class CollageMakerModule {}
