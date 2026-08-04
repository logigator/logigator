import { inject, InjectionToken, Provider } from '@angular/core';

/**
 * The library's stock UI strings — the handful of words its components have to
 * put in the accessibility tree themselves (close/dismiss buttons, paginator
 * steps, the tab-strip's reorder announcement). Everything else a component
 * shows is consumer-supplied content.
 */
export interface LgLabels {
  /** Dialog / drawer / window / image-zoom close buttons. */
  close: string;
  /** A fullscreen window's back button. */
  back: string;
  /** A toast's dismiss button. */
  dismiss: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
}

/** The English defaults, used for any key the app does not provide. */
export const LG_DEFAULT_LABELS: LgLabels = {
  close: 'Close',
  back: 'Back',
  dismiss: 'Dismiss',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page'
};

/**
 * Looks one stock label up on demand. Returning `undefined` falls back to
 * {@link LG_DEFAULT_LABELS}.
 */
export type LgLabelResolver = (key: keyof LgLabels) => string | undefined;

export const LG_LABELS = new InjectionToken<LgLabelResolver>('lg-labels');

/**
 * Supply localized stock strings once, app-wide. Without this every component
 * falls back to {@link LG_DEFAULT_LABELS} (English) — which is why a localized
 * app should provide it: the alternative is passing a label to every dialog,
 * drawer and window individually, and missing the next one that gets added.
 *
 * Per-instance inputs (`closeLabel`, `dismissLabel`, …) still win where a
 * specific surface needs its own wording — and are the way to keep a
 * **long-lived** surface correct across a language switch, since a resolver is
 * only consulted while a component is being constructed.
 *
 * A resolver rather than a plain object: DI caches a factory's result once per
 * injector, so an object of strings built at startup would pin every label to
 * the language active at bootstrap. `resolverFactory` runs once (to reach the
 * app's translation layer); the resolver it returns runs per lookup.
 */
export function provideLgLabels(
  resolverFactory: () => LgLabelResolver
): Provider[] {
  return [{ provide: LG_LABELS, useFactory: resolverFactory }];
}

/**
 * Resolve one stock label for a component's `input()` default. Call in a field
 * initializer — it runs inside the injection context.
 */
export function lgLabel(key: keyof LgLabels): string {
  const resolved = inject(LG_LABELS, { optional: true })?.(key);
  return resolved || LG_DEFAULT_LABELS[key];
}
