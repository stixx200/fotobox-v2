import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from './testing';
import { PhotoRepository } from './photo.repository';
import { settings } from './schema';

describe('createTestDatabase', () => {
  it('applies migrations and supports CRUD', () => {
    const { db, sqlite } = createTestDatabase();

    db.insert(settings)
      .values({
        key: 'layouts',
        value: '["Einzelbild"]',
        description: null,
        updatedAt: new Date().toISOString(),
      })
      .run();

    const row = db.select().from(settings).where(eq(settings.key, 'layouts')).get();
    expect(row?.value).toBe('["Einzelbild"]');

    sqlite.close();
  });
});

describe('PhotoRepository', () => {
  it('inserts, lists, and deletes photo metadata', () => {
    const { db, sqlite } = createTestDatabase();
    const repo = new PhotoRepository(db);

    repo.insertPhoto('photo-1');
    repo.insertPhoto('collage-1');

    expect(repo.listPhotos()).toHaveLength(2);
    expect(repo.photoExists('photo-1')).toBe(true);

    repo.deletePhoto('photo-1');
    expect(repo.photoExists('photo-1')).toBe(false);

    sqlite.close();
  });
});
