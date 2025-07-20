import { Module } from '@nestjs/common';
import { CollageMakerService } from './collage-maker.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [CollageMakerService],
  exports: [CollageMakerService],
})
export class CollageMakerModule {}
