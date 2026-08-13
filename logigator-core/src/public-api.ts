/**
 * Public surface of `@logigator/core`.
 *
 * The package is consumed buildless through the workspace tsconfig `paths`
 * mapping (like `@logigator/ui`): the editor's and the API's bundlers compile
 * this source directly. It stays free of runtime dependencies and of any
 * framework or renderer import — enforced by `eslint.config.mjs` and by a
 * standalone `tsc --noEmit` over the package alone.
 *
 * Boundary rule: core is data to data. Turning live editor objects into
 * documents (and back) stays in the editor.
 */
export { CURRENT_FILE_VERSION } from './format/circuit-file-version';
