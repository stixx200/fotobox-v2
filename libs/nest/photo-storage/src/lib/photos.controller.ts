import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PhotoStorageProviderService } from './photo-storage-provider.service';
import { resolvePhotoPath, sendPhotoFile } from './photo-file';

@Controller('photos')
export class PhotosController {
  constructor(
    private photoStorageProviderService: PhotoStorageProviderService,
  ) {}

  @Get(':filename')
  async getPhoto(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = resolvePhotoPath(
      this.photoStorageProviderService.getPhotoDirectory(),
      filename,
    );
    await sendPhotoFile(res, filePath, {
      'Cache-Control': 'public, max-age=31536000',
    });
  }
}
