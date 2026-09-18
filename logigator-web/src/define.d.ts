/**
 * esbuild `define` constants, substituted at build time (see the `define`
 * option on the build target in `angular.json`). Declared here so TypeScript
 * sees them as globals rather than undefined identifiers.
 */

/** Git short SHA the bundle was built from; empty when not stamped (dev). */
declare const GIT_COMMIT: string;

/** ISO timestamp the bundle was built at; empty when not stamped (dev). */
declare const BUILD_DATE: string;
