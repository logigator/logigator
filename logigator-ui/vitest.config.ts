import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Relative to this config file, so the setup file is found whatever CWD the
// Angular unit-test builder uses.
export default defineConfig({
  test: {
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    maxConcurrency: 1,
    fileParallelism: false,
    // Hide intercepted console output for passing tests; failing tests still
    // print theirs.
    silent: 'passed-only'
  }
});
