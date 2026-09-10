// @ts-check
// Import fence for @logigator/core.
//
// The package is shared by the editor (browser), the API (Node) and the
// migration tooling, so it must stay free of runtime dependencies, framework
// imports and renderer imports. The rules below fail such an import at lint
// time; the `tsc` build (tsconfig.json, no `paths`) is the second layer, and it
// also catches sibling-package imports.
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
                'rxjs',
                'rxjs/*',
                // Includes the sibling packages: core is the bottom layer,
                // `@logigator/contract` depends on it, never the reverse.
                '@logigator/*',
                // A relative import can only leave the package by naming a
                // sibling directory, so match those rather than `../`, which
                // legitimate intra-package imports use.
                '**/logigator-editor/**',
                '**/logigator-ui/**',
                '**/logigator-contract/**',
                '**/logigator-api/**',
                '**/logigator-web/**',
                '**/logigator-backend/**'
              ],
              message:
                'core stays dependency-, framework- and renderer-free, and imports nothing from outside the package. Pass data in instead.'
            }
          ]
        }
      ],
      // Browser globals are as much of a leak as a browser import: core also
      // runs in Node (API, migration script). `CompressionStream` is the one
      // web API it may use — a Node >=18 global too.
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core must run in Node as well.' },
        { name: 'document', message: 'core must run in Node as well.' },
        { name: 'navigator', message: 'core must run in Node as well.' },
        { name: 'localStorage', message: 'core must run in Node as well.' },
        { name: 'sessionStorage', message: 'core must run in Node as well.' }
      ]
    }
  }
]);
