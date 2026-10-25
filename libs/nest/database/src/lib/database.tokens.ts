import type { NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import type { DatabaseSync } from 'node:sqlite';

export const DRIZZLE = Symbol('DRIZZLE');
export const SQLITE_CONNECTION = Symbol('SQLITE_CONNECTION');

/** Tables are imported from `./schema` directly; no relational query config. */
export type DrizzleDb = NodeSQLiteDatabase;
export type SqliteConnection = DatabaseSync;
