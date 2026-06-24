import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from './database.tokens';
import { photos } from './schema';

export type PhotoKind = 'capture' | 'collage';

export interface PhotoRecord {
  id: string;
  filename: string;
  kind: PhotoKind;
  createdAt: string;
}

export function resolvePhotoKind(photoId: string): PhotoKind {
  return photoId.startsWith('collage') ? 'collage' : 'capture';
}

@Injectable()
export class PhotoRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  insertPhoto(photoId: string, createdAt = new Date().toISOString()): void {
    const filename = `${photoId}.jpg`;
    this.db
      .insert(photos)
      .values({
        id: photoId,
        filename,
        kind: resolvePhotoKind(photoId),
        createdAt,
      })
      .onConflictDoUpdate({
        target: photos.id,
        set: {
          filename,
          kind: resolvePhotoKind(photoId),
          createdAt,
        },
      })
      .run();
  }

  deletePhoto(photoId: string): void {
    this.db.delete(photos).where(eq(photos.id, photoId)).run();
  }

  photoExists(photoId: string): boolean {
    const row = this.db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.id, photoId))
      .get();
    return !!row;
  }

  listPhotos(): PhotoRecord[] {
    return this.db
      .select()
      .from(photos)
      .orderBy(desc(photos.createdAt))
      .all()
      .map((row) => ({
        id: row.id,
        filename: row.filename,
        kind: row.kind as PhotoKind,
        createdAt: row.createdAt,
      }));
  }
}
