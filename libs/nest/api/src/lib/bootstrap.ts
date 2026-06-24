import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded, type Express, type RequestHandler } from 'express';
import { applyDefaultWorkspaceEnv } from '@fotobox/workspace-paths';
import { getLogger } from '@fotobox/logging';
import { WinstonLoggerService } from '@fotobox/nest-logger';
import * as os from 'os';
import { ApiModule } from './api.module';
import {
  isLanApiRestrictionEnabled,
  lanAccessMiddleware,
} from './lan-access.middleware';

const logger = getLogger('fotobox-api');

/** Collage editor saves send base64 JPEG backgrounds and assets via GraphQL. */
const GRAPHQL_BODY_LIMIT = process.env['FOTOBOX_GRAPHQL_BODY_LIMIT'] ?? '100mb';

/** Insert parsers near the front of the Express stack (before /graphql). */
function prependMiddleware(
  expressApp: Express,
  ...middleware: RequestHandler[]
): void {
  const router = expressApp.router as unknown as { stack: unknown[] };
  for (const handler of middleware) {
    expressApp.use(handler);
    router.stack.splice(1, 0, router.stack.pop());
  }
}

function installLargeBodyParser(app: NestExpressApplication): void {
  const expressApp = app.getHttpAdapter().getInstance();
  prependMiddleware(
    expressApp,
    json({ limit: GRAPHQL_BODY_LIMIT }),
    urlencoded({ extended: true, limit: GRAPHQL_BODY_LIMIT }),
  );
}

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
  applyDefaultWorkspaceEnv();

  const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
    logger: new WinstonLoggerService(),
    bodyParser: false,
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

  // GraphQL registers during init(); prepend parsers afterward so they run first.
  await app.init();
  installLargeBodyParser(app);
  logger.info(`GraphQL request body limit: ${GRAPHQL_BODY_LIMIT}`);

  const port = options.port ?? (Number(process.env['PORT']) || 3000);
  const host = options.host ?? process.env['HOST'] ?? '0.0.0.0';

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
