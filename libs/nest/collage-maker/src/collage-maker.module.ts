import { Module } from '@nestjs/common';
import { CollageMakerService } from './collage-maker.service';
import { CollageMakerResolver } from './collage-maker.resolver';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [CollageMakerService, CollageMakerResolver],
  exports: [CollageMakerService, CollageMakerResolver],
})
export class CollageMakerModule {}
