/**
 * Build-time constants replaced by the esbuild `define` option: defaults live
 * in angular.json (empty strings, so every plain `ng build`/`ng serve`/IDE
 * compile works), and the root `yarn build` overrides them with real values
 * via `--define` flags. Empty means "not stamped" (dev build). Consumed only
 * by the environment files — app code reads `environment.buildCommit` /
 * `environment.buildDate` instead of these globals.
 */

/** Git short SHA of the commit the bundle was built from. */
declare const GIT_COMMIT: string;

/** ISO-8601 UTC timestamp the bundle was built at; parseable via `new Date()`. */
declare const BUILD_DATE: string;
