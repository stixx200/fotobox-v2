import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { getLogger } from '@fotobox/logging';
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';

const logger = getLogger('PhotosController');

@Controller('photos')
export class PhotosController {
  constructor(
    private photoStorageProviderService: PhotoStorageProviderService,
  ) {}

  @Get(':filename')
  async getPhoto(@Param('filename') filename: string, @Res() res: Response) {
    const photoDirectory = this.photoStorageProviderService.getPhotoDirectory();

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

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Error serving photo ${filename}:`, error);
      throw new NotFoundException('File not found');
    }
  }
}
