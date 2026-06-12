import { Module } from '@nestjs/common';
import { SettingsModule } from '@fotobox/nest-settings';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';
import { LanUrlService } from './lan-url.service';
import { ShareTokenService } from './share-token.service';
import { ShareService } from './share.service';
import { ShareResolver } from './share.resolver';
import { ShareController } from './share.controller';

@Module({
  imports: [SettingsModule, NestPhotoStorageModule],
  controllers: [ShareController],
  providers: [
    LanUrlService,
    ShareTokenService,
    ShareService,
    ShareResolver,
  ],
  exports: [ShareService, LanUrlService],
})
export class ShareApiModule {}
