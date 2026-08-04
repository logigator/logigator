/**
 * Build-time constants replaced by the esbuild `define` option. Every developer
 * switch lives here rather than in `environment.ts`, so any of them can be
 * flipped for a single build or serve without editing tracked source:
 *
 * ```bash
 * yarn start --define "SHOW_HITBOXES=true"
 * ```
 *
 * A CLI `--define` merges into the active configuration's values and wins on
 * conflict. To serve with every switch off, use the production configuration
 * (`yarn start:prod`) rather than listing them — that also covers switches
 * added here later.
 *
 * Defaults live in angular.json under `build.options.define`, and the
 * `development` configuration overrides them. **A `configurations` block
 * replaces `options.define` rather than merging into it**, so every define has
 * to be repeated in the `development` block — an omission there is not a
 * compile error, it ships an unsubstituted identifier that throws at runtime.
 *
 * The module gate below ({@link AUTOMATION_API}) is *not* interchangeable with
 * a runtime constant. esbuild substitutes a define while parsing, before it
 * decides which modules are reachable, so a guard around the only reference to
 * a module drops that module from the bundle. A value read at runtime — an
 * object property, or even a bare exported `const` — folds the branch but keeps
 * the module, because reachability was already settled. So for that one: guard
 * the *sole* reference, inline, and never hold the class in an `inject()` field
 * or behind a helper method — both keep it alive regardless. The other flags
 * have no such constraint; they only gate statements.
 */

/** Git short SHA of the commit the bundle was built from; empty when unstamped. */
declare const GIT_COMMIT: string;

/** ISO-8601 UTC timestamp the bundle was built at; parseable via `new Date()`. */
declare const BUILD_DATE: string;

/** Installs the `window.__logigator` automation facade. False strips it. */
declare const AUTOMATION_API: boolean;

/**
 * Initial state of the title-bar "Debug" menu. Unlike {@link AUTOMATION_API}
 * this is not a module gate — the menu ships in every build so that
 * `window.__logigatorDebug()` can turn it on in production. Session-only: a
 * reload returns to this value.
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
