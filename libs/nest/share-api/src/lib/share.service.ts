import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from '@fotobox/nest-settings';
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';
import { LanUrlService } from './lan-url.service';
import { ShareTokenService } from './share-token.service';
import { ShareLink } from './models/share-link.model';

@Injectable()
export class ShareService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly lanUrlService: LanUrlService,
    private readonly shareTokenService: ShareTokenService,
    private readonly photoStorage: PhotoStorageProviderService,
  ) {}

  async createShareLink(filename: string): Promise<ShareLink> {
    if (!(await this.isShareEnabled())) {
      throw new ForbiddenException('Photo sharing is disabled in settings');
    }

    const safeFilename = this.sanitizeFilename(filename);
    const photoId = safeFilename.replace(/\.(jpg|jpeg|png)$/i, '');
    if (!this.photoStorage.photoExists(photoId)) {
      throw new NotFoundException(`Photo not found: ${safeFilename}`);
    }

    const expiryHours = await this.getTokenExpiryHours();
    const record = await this.shareTokenService.createToken(
      safeFilename,
      expiryHours,
    );
    const baseUrl = await this.lanUrlService.getShareBaseUrl();

    return {
      url: `${baseUrl}/api/share/${record.token}`,
      token: record.token,
      expiresAt: record.expiresAt,
    };
  }

  getDetectedShareBaseUrl(): string {
    return this.lanUrlService.getDetectedShareBaseUrl();
  }

  private async isShareEnabled(): Promise<boolean> {
    const setting = await this.settingsService.getSetting('useShare');
    if (!setting?.value) {
      return false;
    }
    try {
      return JSON.parse(setting.value) === true;
    } catch {
      return false;
    }
  }

  private async getTokenExpiryHours(): Promise<number> {
    const setting = await this.settingsService.getSetting('shareTokenExpiryHours');
    if (!setting?.value) {
      return 24;
    }
    try {
      const parsed = JSON.parse(setting.value);
      const hours = Number(parsed);
      return Number.isFinite(hours) && hours > 0 ? hours : 24;
    } catch {
      return 24;
    }
  }

  private sanitizeFilename(filename: string): string {
    const base = filename.split(/[/\\]/).pop() ?? filename;
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!sanitized || sanitized.includes('..')) {
      throw new BadRequestException('Invalid photo filename');
    }
    return sanitized;
  }
}
