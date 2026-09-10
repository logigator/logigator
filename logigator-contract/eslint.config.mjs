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
      // `import * as z from 'zod'`, never `import { z }`. zod's `z` export is a
      // namespace object holding every locale table and the JSON-Schema
      // generator; a named import of it is one opaque value a bundler cannot
      // see into, so all of it lands in every browser client that ships these
      // schemas. A namespace import is analysed property by property and drops
      // what no schema here touches — measured at 35kB gzipped off the editor's
      // bundle. `no-restricted-imports` cannot express this: it reads
      // `import * as z` as importing every name, the restricted one included.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='zod'] > ImportSpecifier[imported.name='z']",
          message:
            "import zod as a namespace (`import * as z from 'zod'`); a named `z` import defeats tree-shaking and ships every locale to every client."
        }
      ],
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
