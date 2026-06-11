import { Module } from '@nestjs/common';
import { WindowModule } from '@fotobox/electron-window';
import { AppServiceModule } from '@fotobox/nest-app-service';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { CollageMakerModule } from '@fotobox/nest-collage-maker';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { getLogger } from '@fotobox/logging';
import { SettingsModule } from '@fotobox/nest-settings';
import { CamerasApiModule } from '@fotobox/nest-cameras-api';
import { PrinterApiModule } from '@fotobox/nest-printer-api';
import { FotoboxError } from '@fotobox/error';
import { GraphqlModule } from '@fotobox/nest-graphql';
import { PhotosController } from './photos.controller';

const logger = getLogger('AppModule');

// Determine the UI URL based on environment
const getUIUrl = (): string => {
  const url =
    process.env.FOTOBOX_DEV_SERVER ||
    pathToFileURL(path.join(__dirname, 'fotobox-ui/index.html')).toString();

  logger.info(`Loading UI from: ${url}`);
  return url;
};

// Default configuration
const getDefaultConfig = () => {
  const cwd = process.cwd();
  return {
    photoDirectory: path.join(cwd, 'photos'),
    templateDirectory: path.join(cwd, 'collage-templates'),
  };
};

@Module({
  imports: [
    ...(process.env.FOTOBOX_SKIP_VIEW
      ? []
      : [
          WindowModule.register({
            url: getUIUrl(),
          }),
        ]),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getDefaultConfig],
    }),
    GraphqlModule,
    CollageMakerModule,
    SettingsModule,
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
export class AppModule {}
