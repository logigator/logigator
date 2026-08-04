// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
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
        tsconfigRootDir: __dirname
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
    rules: {}
  }
]);
