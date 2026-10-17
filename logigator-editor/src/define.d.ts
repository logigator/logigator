/**
 * Build-time constants replaced by the esbuild `define` option. Developer
 * switches live here rather than in `environment.ts`, so one can be flipped for
 * a single build or serve without editing tracked source:
 *
 * ```bash
 * yarn start:editor --define "SHOW_HITBOXES=true"
 * ```
 *
 * A CLI `--define` merges into the active configuration and wins on conflict.
 * To serve with every switch off, use the production configuration
 * (`yarn start:editor:prod`), which also covers switches added later.
 *
 * Defaults live in angular.json under `build.options.define`. **A
 * `configurations` block replaces `options.define` rather than merging into
 * it**, so every define must be repeated in the `development` block; an
 * omission ships an unsubstituted identifier that throws at runtime.
 *
 * A module gate ({@link AUTOMATION_API}) is *not* interchangeable with a
 * runtime constant. esbuild substitutes a define while parsing, before module
 * reachability is settled, so a guard around the sole reference to a module
 * drops that module from the bundle; a value read at runtime — an object
 * property, or even a bare exported `const` — folds the branch but keeps the
 * module. So guard the *sole* reference, inline, and never hold the class in an
 * `inject()` field or behind a helper method. The other flags only gate
 * statements and carry no such constraint.
 */

/** Git short SHA of the commit the bundle was built from; empty when unstamped. */
declare const GIT_COMMIT: string;

/** ISO-8601 UTC timestamp the bundle was built at; parseable via `new Date()`. */
declare const BUILD_DATE: string;

/** Installs the `window.__logigator` automation facade. False strips it. */
declare const AUTOMATION_API: boolean;

/**
 * Initial state of the title-bar "Debug" menu. Not a module gate: the menu
 * ships in every build so `window.__logigatorDebug()` can turn it on in
 * production. Session-only — a reload returns to this value.
 */
declare const DEBUG_MENU: boolean;

/** Outlines every background grid tile in red. */
declare const SHOW_GRID_BORDERS: boolean;

/** Fills each component's local bounds in translucent red. */
declare const SHOW_HITBOXES: boolean;

/** Marks each component's origin with a white square. */
declare const SHOW_ORIGINS: boolean;

/** Marks each component's connection points with yellow squares. */
declare const SHOW_CONNECTION_POINTS: boolean;
