import { defineConfig } from 'vitest/config';
import 'zone.js';
import 'zone.js/testing';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.mts'],
  },
});
