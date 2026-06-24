import { Global, Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { getDatabasePath } from '@fotobox/workspace-paths';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DRIZZLE,
  SQLITE_CONNECTION,
  type DrizzleDb,
  type SqliteConnection,
} from './database.tokens';
import { getMigrationsFolder } from './migrations';
import { PhotoRepository } from './photo.repository';
import { schema } from './schema';

const logger = getLogger('DatabaseModule');

@Global()
@Module({
  providers: [
    PhotoRepository,
    {
      provide: SQLITE_CONNECTION,
      useFactory: (): SqliteConnection => {
        const dbPath = getDatabasePath();
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        logger.info(`Opening SQLite database at ${dbPath}`);
        const sqlite = new DatabaseSync(dbPath);
        sqlite.exec('PRAGMA journal_mode = WAL');
        return sqlite;
      },
    },
    {
      provide: DRIZZLE,
      inject: [SQLITE_CONNECTION],
      useFactory: (sqlite: SqliteConnection): DrizzleDb =>
        drizzle({ client: sqlite, schema }),
    },
  ],
  exports: [DRIZZLE, PhotoRepository],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(SQLITE_CONNECTION) private readonly sqlite: SqliteConnection,
  ) {}

  onModuleInit(): void {
    const migrationsFolder = getMigrationsFolder();
    logger.info(`Running database migrations from ${migrationsFolder}`);
    migrate(this.db, { migrationsFolder });
  }

  onModuleDestroy(): void {
    this.sqlite.close();
  }
}
