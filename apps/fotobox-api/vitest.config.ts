import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Integration tests: boot the real Nest API in-process on an ephemeral port
 * with isolated temp data, then talk to it over HTTP / graphql-ws.
 * Run with `pnpm nx test fotobox-api`.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [tsconfigPaths()],
  test: {
    name: 'fotobox-api-integration',
    globals: false,
    environment: 'node',
    include: ['integration/**/*.integration.spec.ts'],
    // Runs before each test file's imports: points every data path at a
    // fresh temp dir before the logger / photo storage singletons are created.
    setupFiles: ['integration/support/isolated-env.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    watch: false,
    reporters: ['default'],
    // The API logs every request; show the output only for failing tests.
    silent: 'passed-only',
  },
});
