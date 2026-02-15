import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  resolve: {
    alias: {
      '@fotobox/cameras': path.resolve(__dirname, '../../cameras/index.ts'),
      '@fotobox/collage-maker': path.resolve(
        __dirname,
        '../../collage-maker/src/index.ts'
      ),
      '@fotobox/electron-window': path.resolve(
        __dirname,
        '../../electron/window/src/index.ts'
      ),
      '@fotobox/error': path.resolve(__dirname, '../../error/src/index.ts'),
      '@fotobox/logging': path.resolve(__dirname, '../../logging/src/index.ts'),
      '@fotobox/nest-app-service': path.resolve(
        __dirname,
        '../app-service/src/index.ts'
      ),
      '@fotobox/nest-collage-maker': path.resolve(__dirname, './src/index.ts'),
      '@fotobox/nest-logger': path.resolve(__dirname, '../logger/src/index.ts'),
    },
  },
});
