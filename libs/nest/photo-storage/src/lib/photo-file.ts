import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('PhotoFile');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Resolve `filename` inside `photoDirectory`. Throws NotFound for anything that
 * escapes the directory (`../x`, absolute paths, or sibling directories that
 * share a name prefix such as `photos-backup/`).
 */
export function resolvePhotoPath(
  photoDirectory: string,
  filename: string,
): string {
  const root = path.resolve(photoDirectory);
  const resolved = path.resolve(root, filename);
  const relative = path.relative(root, resolved);
  if (
    !relative ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    filename.includes('\0')
  ) {
    throw new NotFoundException('Photo not found');
  }
  return resolved;
}

export function photoContentType(filePath: string): string {
  return (
    CONTENT_TYPES[path.extname(filePath).toLowerCase()] ??
    'application/octet-stream'
  );
}

/**
 * Stream a photo to the response. Stat happens before headers are written so
 * missing files map to 404; read errors after that destroy the response
 * instead of leaving the request hanging.
 */
export async function sendPhotoFile(
  res: Response,
  filePath: string,
  headers: Record<string, string> = {},
): Promise<void> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    throw new NotFoundException('Photo not found');
  }
  if (!stat.isFile()) {
    throw new NotFoundException('Photo not found');
  }

  res.setHeader('Content-Type', photoContentType(filePath));
  res.setHeader('Content-Length', String(stat.size));
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }

  await new Promise<void>((resolve) => {
    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
      logger.error(`Error streaming photo ${filePath}:`, error);
      res.destroy(error);
      resolve();
    });
    res.on('close', () => {
      stream.destroy();
      resolve();
    });
    stream.pipe(res);
  });
}
