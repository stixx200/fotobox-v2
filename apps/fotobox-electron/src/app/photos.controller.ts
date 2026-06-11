import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { getLogger } from '@fotobox/logging';
import { SettingsService } from '@fotobox/nest-settings';

const logger = getLogger('PhotosController');

@Controller('photos')
export class PhotosController {
  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  @Get(':filename')
  async getPhoto(@Param('filename') filename: string, @Res() res: Response) {
    // Try to get photo directory from settings first, fallback to config
    const settings = await this.settingsService.getAllSettings();
    const photoDirSetting = settings.find((s) => s.key === 'photoDirectory');
    console.log('photoDirSetting', photoDirSetting);
    const photoDirectory =
      photoDirSetting?.value && photoDirSetting.value !== '""'
        ? JSON.parse(photoDirSetting.value)
        : this.configService.getOrThrow<string>('photoDirectory');

    const filePath = path.join(photoDirectory, filename);

    // Security check: ensure the file is within the photo directory
    const resolvedPath = path.resolve(filePath);
    const resolvedPhotoDir = path.resolve(photoDirectory);

    if (!resolvedPath.startsWith(resolvedPhotoDir)) {
      throw new NotFoundException('File not found');
    }

    try {
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('File not found');
      }

      // Set appropriate headers
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Error serving photo ${filename}:`, error);
      throw new NotFoundException('File not found');
    }
  }
}
