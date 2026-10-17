import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Specs run on plain Vitest in Node. Nest resolves constructor dependencies from
// `design:paramtypes` metadata, which Vitest's transform emits because
// tsconfig.json sets `emitDecoratorMetadata` — dropping that option breaks
// type-based DI in specs, not just in the build. Vitest finds that config by
// convention, so the filename is load-bearing: rename it and specs fail at DI
// time rather than at type-check time.
//
// The workspace packages are aliased to their source, mirroring the tsconfig
// `paths` mapping the bundler reads, so specs compile exactly what ships.
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
      ),
      '@logigator/contract': fileURLToPath(
        new URL('../logigator-contract/src/public-api.ts', import.meta.url)
      )
    }
  }
});
