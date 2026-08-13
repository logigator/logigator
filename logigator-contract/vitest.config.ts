import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The contract is framework-free, so its specs run on plain Vitest in Node.
// `@logigator/core` is aliased to its source, mirroring the workspace tsconfig
// `paths` mapping: the package is never built, every consumer compiles it.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '@logigator/core': fileURLToPath(
        new URL('../logigator-core/src/public-api.ts', import.meta.url)
      )
    }
  }
});
