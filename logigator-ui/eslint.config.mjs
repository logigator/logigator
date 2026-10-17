// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lg',
          style: 'camelCase'
        }
      ],
      // Most components are elements; a skin that has to be the interactive
      // element itself (`button[lgButton]`) is an attribute one instead.
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'lg', style: 'kebab-case' },
          { type: 'attribute', prefix: 'lg', style: 'camelCase' }
        ]
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      // Outputs use PrimeNG-style `on`-prefixed names (onClick, onSelect, …).
      '@angular-eslint/no-output-on-prefix': 'off',
      'no-console': 'error'
    }
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility
    ],
    rules: {
      // An icon-only `<button lgButton>` carries no template content and takes
      // its accessible name from the `ariaLabel` input, which this rule cannot
      // see. `[attr.aria-label]`, which it does accept, collides with the
      // component's own host binding.
      '@angular-eslint/template/elements-content': [
        'error',
        { allowList: ['lgButton'] }
      ]
    }
  }
]);
