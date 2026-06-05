import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    maxConcurrency: 1,
    fileParallelism: false
  }
});
