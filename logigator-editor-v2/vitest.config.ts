import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Resolve relative to this config file (not the workspace root) so the setup
// file is found regardless of the CWD/root the Angular unit-test builder uses.
export default defineConfig({
  test: {
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    maxConcurrency: 1,
    fileParallelism: false,
    // Suppress intercepted console output for passing tests (the editor logs
    // freely at Debug in the test build); failing tests still print their logs.
    silent: 'passed-only'
  }
});
