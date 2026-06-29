/**
 * Severity selects a component's color role. The default (no `severity`) is the
 * primary role; the named values map to the surface (`secondary`) and semantic
 * state (`info`/`warn`/`danger`) palettes.
 *
 * The concrete class mapping is component-specific (a solid button, a subtle
 * tag and a badge each render a severity differently), so each component owns
 * its own severity→class table built on these names.
 */
export type LgSeverity = 'secondary' | 'warn' | 'info' | 'danger';
