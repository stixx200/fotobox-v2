import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '@fotobox/nest-database';
import { ShareTokenService } from './share-token.service';

describe('ShareTokenService', () => {
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];
  let service: ShareTokenService;

  beforeEach(async () => {
    const testDb = createTestDatabase();
    sqlite = testDb.sqlite;
    service = new ShareTokenService(testDb.db);
    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    sqlite.close();
  });

  it('creates and validates a token', async () => {
    const record = await service.createToken('photo-1.jpg', 2);
    expect(record.filename).toBe('photo-1.jpg');
    expect(service.getValidToken(record.token)?.filename).toBe('photo-1.jpg');
  });

  it('rejects unknown tokens', () => {
    expect(service.getValidToken('missing-token')).toBeNull();
  });
});
