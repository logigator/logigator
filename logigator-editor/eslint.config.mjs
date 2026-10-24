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
          prefix: 'app',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@jsverse/transloco',
              importNames: ['TranslocoDirective', 'TranslocoPipe'],
              message:
                'Use TranslateDirective (*appTranslate) in templates and TranslationService in TypeScript.'
            }
          ]
        }
      ]
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
