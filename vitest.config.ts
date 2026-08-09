import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'entrypoints/**/*.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts'],
  },
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(dirname, 'src') } },
});
