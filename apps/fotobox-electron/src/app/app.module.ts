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
import { FotoboxError } from '@fotobox/error';

const logger = getLogger('GraphQL');

@Module({
  imports: [
    AppServiceModule,
    WindowModule.register({
      url: pathToFileURL(
        path.join(__dirname, 'fotobox-ui/index.html')
      ).toString(),
    }),
    CollageMakerModule,
    SettingsModule,
    CamerasApiModule,
    ConfigModule.forRoot({}),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      path: '/graphql',
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': false,
      },
      formatError: (error) => {
        // Log all errors
        logger.error('GraphQL Error:', {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
        });

        // If it's a FotoboxError, include the error code in extensions
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
      context: ({ req, connection }: { req?: any; connection?: any }) => {
        if (connection) {
          // WebSocket connection context
          return { subscription: true };
        }
        // HTTP request context
        return { req };
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
