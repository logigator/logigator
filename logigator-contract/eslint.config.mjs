// @ts-check
// Import fence for @logigator/contract.
//
// The contract is imported by the server *and* by browser clients, so it stays
// framework- and renderer-free; zod and `@logigator/core` are its only
// dependencies. These rules are the fence: tsconfig.json maps `@logigator/core`
// and nothing else, but its `rootDir` is the repo, so a relative path into a
// sibling package type-checks regardless of the mapping.
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
                '@nestjs/*',
                'fastify',
                '@logigator/ui',
                '**/logigator-editor/**',
                '**/logigator-ui/**',
                '**/logigator-api/**',
                '**/logigator-web/**',
                '**/logigator-backend/**'
              ],
              message:
                'the contract describes the API surface for every client: zod and @logigator/core only, no framework, renderer or server imports.'
            }
          ]
        }
      ]
    }
  }
]);
