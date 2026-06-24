import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: text('updated_at').notNull(),
});

export const shareTokens = sqliteTable(
  'share_tokens',
  {
    token: text('token').primaryKey(),
    filename: text('filename').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('share_tokens_expires_at_idx').on(table.expiresAt)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    kind: text('kind').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('photos_created_at_idx').on(table.createdAt)],
);

export const schema = {
  settings,
  shareTokens,
  photos,
};
