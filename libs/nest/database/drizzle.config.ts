import { defineConfig } from 'drizzle-kit';
import path from 'node:path';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url:
      process.env['FOTOBOX_DATABASE_PATH'] ??
      path.join('tmp', 'runtime', 'fotobox', 'fotobox.db'),
  },
});
