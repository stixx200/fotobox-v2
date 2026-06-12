import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { getLogger } from '@fotobox/logging';
import { FotoboxError } from '@fotobox/error';
import { GraphqlModule } from '@fotobox/nest-graphql';
import { SettingsModule } from '@fotobox/nest-settings';
import { CamerasApiModule } from '@fotobox/nest-cameras-api';
import { PrinterApiModule } from '@fotobox/nest-printer-api';
import { CollageMakerModule } from '@fotobox/nest-collage-maker';
import { AppServiceModule } from '@fotobox/nest-app-service';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { getDefaultConfig } from './api.config';
import { PhotosController } from './photos.controller';

const logger = getLogger('ApiModule');

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
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      path: '/graphql',
      subscriptions: {
        'graphql-ws': true,
      },
      formatError: (error) => {
        logger.error('GraphQL Error:', {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
        });

        if (error.extensions?.originalError instanceof FotoboxError) {
          const fotoboxError = error.extensions.originalError as FotoboxError;
          return {
            ...error,
            extensions: {
              ...error.extensions,
              code: fotoboxError.code,
              info: fotoboxError.info,
            },
          };
        }

        return error;
      },
    }),
  ],
  controllers: [PhotosController],
  providers: [],
})
export class ApiModule {}
