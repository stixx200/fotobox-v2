import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { PrinterResolver } from './printer.resolver';

@Module({
  controllers: [],
  providers: [PrinterService, PrinterResolver],
  exports: [PrinterService, PrinterResolver],
})
export class PrinterApiModule {}
