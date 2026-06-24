import type { NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import type { DatabaseSync } from 'node:sqlite';
import type { schema } from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const SQLITE_CONNECTION = Symbol('SQLITE_CONNECTION');

export type DrizzleDb = NodeSQLiteDatabase<typeof schema>;
export type SqliteConnection = DatabaseSync;
