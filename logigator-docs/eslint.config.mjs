// @ts-check
// Import fence for @logigator/docs.
//
// The member is content plus pure data: the markdown, its screenshots and the
// page structure. It is compiled by the editor (browser) and by the website
// (browser and server render), so it must stay free of framework imports and
// of anything a sibling package owns. The `tsc` config (tsconfig.json, no
// `paths`) is the second layer, and it also catches sibling-package imports.
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
                '@logigator/*',
                // A relative import can only leave the package by naming a
                // sibling directory, so match those rather than `../`, which
                // legitimate intra-package imports use.
                '**/logigator-editor/**',
                '**/logigator-ui/**',
                '**/logigator-core/**',
                '**/logigator-contract/**',
                '**/logigator-api/**',
                '**/logigator-web/**',
                '**/logigator-backend/**'
              ],
              message:
                'the documentation member holds content and pure data, and imports nothing from outside the package.'
            },
            {
              group: ['**/*.md'],
              message:
                'the markdown is imported by each app, never from here: the editor emits a .md as a file and the website as text, so one import map cannot serve both.'
            }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'the member is rendered on the server too.'
        },
        {
          name: 'document',
          message: 'the member is rendered on the server too.'
        },
        {
          name: 'navigator',
          message: 'the member is rendered on the server too.'
        }
      ]
    }
  }
]);
