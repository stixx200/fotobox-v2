import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '@fotobox/logging';
import { PhotoStorageProviderService } from './photo-storage-provider.service';

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
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Error serving photo ${filename}:`, error);
      throw new NotFoundException('File not found');
    }
  }
}
