import { Module } from '@nestjs/common';
import { AppService } from './app-service.service';
import { AppResolver } from './app.resolver';

@Module({
  controllers: [],
  providers: [AppService, AppResolver],
  exports: [AppService, AppResolver],
})
export class AppServiceModule {}
