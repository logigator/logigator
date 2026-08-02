/**
 * Severity selects a component's color role. The default (no `severity`) is the
 * primary role; the named values map to the neutral (`none`), surface
 * (`secondary`) and semantic state (`info`/`success`/`warn`/`danger`) palettes.
 * `danger` is the canonical name for the red `error-*` palette (some hosts pass
 * `error`; components normalize it to `danger`).
 *
 * The concrete class mapping is component-specific (a solid button, a subtle
 * tag and a badge each render a severity differently), so each component owns
 * its own severity→class table built on these names.
 */
export type LgSeverity =
  'none' | 'secondary' | 'info' | 'success' | 'warn' | 'danger';
