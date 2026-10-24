/*
 * Build-time constants, replaced by Rspack's DefinePlugin (rspack.config.mjs)
 * and by Vitest's `define` in specs.
 */

/** Git short SHA of the commit the bundle was built from; empty when unstamped. */
declare const GIT_COMMIT: string;

/** ISO-8601 UTC timestamp the bundle was built at; empty when unstamped. */
declare const BUILD_DATE: string;
