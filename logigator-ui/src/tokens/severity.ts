/**
 * Severity selects a component's color role; an omitted one is the primary
 * role. `danger` is the canonical name for the red `error-*` palette, and
 * components normalize a host's `error` to it.
 *
 * The class mapping is component-specific — a solid button, a subtle tag and a
 * badge each render a severity differently — so each owns its own table.
 */
export type LgSeverity =
  'none' | 'secondary' | 'info' | 'success' | 'warn' | 'danger';
