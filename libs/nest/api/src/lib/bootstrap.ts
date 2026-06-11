import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getLogger } from '@fotobox/logging';
import { WinstonLoggerService } from '@fotobox/nest-logger';
import { ApiModule } from './api.module';

const logger = getLogger('fotobox-api');

export interface BootstrapApiOptions {
  /** Port to listen on. Defaults to `process.env.PORT` or 3000. */
  port?: number;
  /** Host/interface to bind. Defaults to `process.env.HOST` or 0.0.0.0. */
  host?: string;
}

/**
 * Creates and starts the Fotobox API server. Shared by the standalone API app
 * and the Electron host so both run an identical backend.
 */
export async function bootstrapApiServer(
  options: BootstrapApiOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(ApiModule, {
    logger: new WinstonLoggerService(),
  });

  // Allow the UI client (potentially served from a different origin/device)
  // to reach the API.
  app.enableCors();

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, { exclude: ['graphql'] });

  const port = options.port ?? (Number(process.env.PORT) || 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.info(
    `🚀 Fotobox API is running on: http://${host}:${port}/${globalPrefix} (GraphQL at /graphql)`,
  );

  return app;
}
