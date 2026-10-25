import { Module } from '@nestjs/common';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { PrinterService } from './printer.service';
import { PrinterResolver } from './printer.resolver';

@Module({
  imports: [NestPhotoStorageModule],
  controllers: [],
  providers: [PrinterService, PrinterResolver],
  exports: [PrinterService, PrinterResolver],
})
export class PrinterApiModule {}
