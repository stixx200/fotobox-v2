import {
  Controller,
  Get,
  GoneException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  PhotoStorageProviderService,
  resolvePhotoPath,
  sendPhotoFile,
} from '@fotobox/nest-photo-storage';
import { ShareTokenService } from './share-token.service';

@Controller('share')
export class ShareController {
  constructor(
    private readonly shareTokenService: ShareTokenService,
    private readonly photoStorage: PhotoStorageProviderService,
  ) {}

  @Get(':token')
  async getSharedPhoto(
    @Param('token') token: string,
    @Query('download') download: string | undefined,
    @Query('inline') inline: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const record = this.shareTokenService.getValidToken(token);
    if (!record) {
      throw new GoneException('This share link has expired or is invalid');
    }

    const filePath = resolvePhotoPath(
      this.photoStorage.getPhotoDirectory(),
      record.filename,
    );

    if (download === '1' || download === 'true') {
      await sendPhotoFile(res, filePath, {
        'Content-Disposition': `attachment; filename="${encodeURIComponent(record.filename)}"`,
      });
      return;
    }

    if (inline === '1' || inline === 'true') {
      await sendPhotoFile(res, filePath, {
        'Cache-Control': 'private, max-age=3600',
      });
      return;
    }

    const imageUrl = `/api/share/${encodeURIComponent(token)}?inline=1`;
    const downloadUrl = `/api/share/${encodeURIComponent(token)}?download=1`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fotobox Photo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #111;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem;
    }
    img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 0.25rem;
      margin: 1.5rem 0;
    }
    a.download {
      display: inline-block;
      background: #1976d2;
      color: #fff;
      text-decoration: none;
      padding: 1rem 2rem;
      border-radius: 0.25rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    p.hint {
      margin-top: 1rem;
      color: #aaa;
      font-size: 0.875rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="Fotobox photo" />
  <a class="download" href="${downloadUrl}">Download photo</a>
  <p class="hint">Link expires ${new Date(record.expiresAt).toLocaleString()}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
