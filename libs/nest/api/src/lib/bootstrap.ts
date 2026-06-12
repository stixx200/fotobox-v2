import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getLogger } from '@fotobox/logging';
import { WinstonLoggerService } from '@fotobox/nest-logger';
import * as os from 'os';
import { ApiModule } from './api.module';
import {
  isLanApiRestrictionEnabled,
  lanAccessMiddleware,
} from './lan-access.middleware';

const logger = getLogger('fotobox-api');

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function listLanIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    if (!addrs) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }
  return addresses;
}

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

  if (isLanApiRestrictionEnabled()) {
    app.use(lanAccessMiddleware);
    logger.info(
      'LAN access restricted to /api/share/* — set FOTOBOX_ALLOW_LAN_API=1 for full LAN API (tablet mode).',
    );
  }

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, { exclude: ['graphql'] });

  const port = options.port ?? (Number(process.env.PORT) || 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.info(
    `🚀 Fotobox API is running on: http://${host}:${port}/${globalPrefix} (GraphQL at /graphql)`,
  );

  if (isLoopbackHost(host)) {
    logger.warn(
      'API is bound to localhost only — guest phones on the LAN cannot open QR share links.',
    );
  } else {
    const lanAddresses = listLanIpv4Addresses();
    if (lanAddresses.length > 0) {
      for (const ip of lanAddresses) {
        logger.info(
          `LAN access (share links): http://${ip}:${port}/${globalPrefix}/share/…`,
        );
      }
    } else {
      logger.warn(
        'No LAN IPv4 address detected — check Wi‑Fi and share settings.',
      );
    }
  }

  return app;
}
