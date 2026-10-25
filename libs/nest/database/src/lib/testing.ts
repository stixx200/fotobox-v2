import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DatabaseSync } from 'node:sqlite';
import type { DrizzleDb, SqliteConnection } from './database.tokens';
import { getMigrationsFolder } from './migrations';

export function createTestDatabase(): {
  db: DrizzleDb;
  sqlite: SqliteConnection;
} {
  const sqlite = new DatabaseSync(':memory:');
  const db = drizzle({ client: sqlite });
  migrate(db, { migrationsFolder: getMigrationsFolder() });
  return { db, sqlite };
}
