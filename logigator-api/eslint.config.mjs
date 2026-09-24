// @ts-check
// Lint config for logigator-api. Node/NestJS code: no Angular or renderer
// imports, and no browser-only packages. The rules below are the layering
// fence — tsconfig.json cannot be one, because its `rootDir` is the repo and
// every workspace member is symlinked into the root `node_modules`, so both a
// relative escape and a bare deep import resolve unless the target package
// closes itself off (the editor's `"exports": {}`).
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Server logging goes through Nest's Logger / the Fastify logger, which
      // are configurable and structured.
      'no-console': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@angular/*',
                'pixi.js',
                'pixi.js/*',
                '@logigator/ui',
                '@logigator/ui/*',
                '**/logigator-editor/**',
                '**/logigator-ui/**',
                '**/logigator-backend/**'
              ],
              message:
                'the API shares code with the editor only through @logigator/core and @logigator/contract.'
            }
          ]
        }
      ]
    }
  }
]);
