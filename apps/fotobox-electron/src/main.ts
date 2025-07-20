import { NestFactory } from '@nestjs/core';
import { getLogger } from '@fotobox/logging';
import { AppModule } from './app/app.module';
import { AppService } from '@fotobox/nest-app-service';
import { WinstonLoggerService } from '@fotobox/nest-logger';

const logger = getLogger();

async function bootstrapApp() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLoggerService(),
  });
  const appService = app.get(AppService) as AppService;
  appService.setApp(app);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.info(
    `🚀 Application backend is running on: http://localhost:${port}/${globalPrefix}`
  );
}

await bootstrapApp();
