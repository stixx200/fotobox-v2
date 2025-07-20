import { Module } from '@nestjs/common';
import { WindowModule } from '@fotobox/electron-window';
import { AppServiceModule } from '@fotobox/nest-app-service';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { CollageMakerModule } from '@fotobox/nest-collage-maker';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AppServiceModule,
    WindowModule.register({
      url: pathToFileURL(
        path.join(__dirname, 'fotobox-ui/index.html')
      ).toString(),
    }),
    CollageMakerModule,
    ConfigModule.forRoot({}),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
