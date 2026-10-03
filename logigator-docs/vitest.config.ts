import { defineConfig } from 'vitest/config';

// The member is framework-free, so its specs run on plain Vitest in a Node
// environment — no Angular unit-test builder, no jsdom, no setup file.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    environment: 'node'
  }
});
