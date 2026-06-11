import { NestFactory } from '@nestjs/core';
import { getLogger } from '@fotobox/logging';
import { AppModule } from './app/app.module';
import { AppService } from '@fotobox/nest-app-service';
import { WinstonLoggerService } from '@fotobox/nest-logger';
import { EventEmitter } from 'events';

const logger = getLogger();

async function bootstrapApp() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: new WinstonLoggerService(),
    });
    const appService = app.get(AppService) as AppService;
    appService.setApp(app);

    // Enable CORS
    app.enableCors();

    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.info(
      `🚀 Application backend is running on: http://localhost:${port}/${globalPrefix}`,
    );
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

await bootstrapApp();
