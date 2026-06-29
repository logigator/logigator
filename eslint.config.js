// @ts-check
// Workspace-root ESLint flat config.
//
// Its role is to enable Flat Config mode for the @angular-eslint lint builder,
// which detects flat config by the presence of an `eslint.config.*` file at the
// workspace root. Each project lints with its own config, selected via the
// `eslintConfig` option on its lint target in angular.json
// (logigator-editor-v2/eslint.config.js, logigator-ui/eslint.config.js).
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: ['dist/', 'node_modules/', '.angular/', 'out-tsc/']
  }
]);
