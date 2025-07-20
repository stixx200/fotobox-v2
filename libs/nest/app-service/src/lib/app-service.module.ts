import { Module } from '@nestjs/common';
import { AppService } from './app-service.service';

@Module({
  controllers: [],
  providers: [AppService],
  exports: [AppService],
})
export class AppServiceModule {}
