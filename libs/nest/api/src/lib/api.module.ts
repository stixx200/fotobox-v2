import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { getLogger } from '@fotobox/logging';
import { DatabaseModule } from '@fotobox/nest-database';
import { GraphqlModule } from '@fotobox/nest-graphql';
import { SettingsModule } from '@fotobox/nest-settings';
import { CamerasApiModule } from '@fotobox/nest-cameras-api';
import { PrinterApiModule } from '@fotobox/nest-printer-api';
import { CollageMakerModule } from '@fotobox/nest-collage-maker';
import { AppServiceModule } from '@fotobox/nest-app-service';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { ShareApiModule } from '@fotobox/nest-share-api';
import type { IncomingMessage } from 'http';
import type { Context } from 'graphql-ws';
import { getDefaultConfig } from './api.config';
import {
  isFullAccessAllowed,
  normalizeClientIp,
  readOriginHeader,
  resolveAccessPolicy,
} from './access-policy';
import { FotoboxExceptionFilter } from './fotobox-exception.filter';

const logger = getLogger('ApiModule');

/**
 * WebSocket upgrades bypass Express middleware, so the access policy must be
 * enforced here as well — graphql-ws executes queries and mutations, not just
 * subscriptions. Returning false closes the socket with 4403 Forbidden.
 */
function authorizeGraphqlWsConnection(
  context: Context<Record<string, unknown> | undefined, unknown>,
): boolean {
  const { request } = context.extra as { request: IncomingMessage };
  const allowed = isFullAccessAllowed(
    {
      remoteAddress: request.socket.remoteAddress,
      origin: readOriginHeader(request.headers),
      token: context.connectionParams?.['token'],
    },
    resolveAccessPolicy(),
  );
  if (!allowed) {
    logger.warn(
      `Blocked GraphQL WebSocket from ${normalizeClientIp(request.socket.remoteAddress) || 'unknown'}`,
    );
  }
  return allowed;
}

/**
 * Shared backend module for the Fotobox API. Used by both the standalone
 * `fotobox-api` server and the embedded Electron host so there is a single
 * source of truth for the GraphQL/REST surface and its feature modules.
 *
 * Note: deliberately does NOT include any Electron window concerns — those
 * live in the Electron shell only.
 */
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getDefaultConfig],
    }),
    GraphqlModule,
    CollageMakerModule,
    SettingsModule,
    NestPhotoStorageModule,
    CamerasApiModule,
    PrinterApiModule,
    AppServiceModule,
    ShareApiModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground:
        process.env['FOTOBOX_GRAPHQL_PLAYGROUND'] === '1' ||
        process.env['NODE_ENV'] !== 'production',
      path: '/graphql',
      subscriptions: {
        'graphql-ws': {
          onConnect: authorizeGraphqlWsConnection,
        },
      },
      formatError: (error) => {
        logger.error('GraphQL Error:', {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
        });
        return error;
      },
    }),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: FotoboxExceptionFilter,
    },
  ],
})
export class ApiModule {}
