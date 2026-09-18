import { inject, InjectionToken, Provider } from '@angular/core';

/**
 * The library's stock UI strings: the words its components put in the
 * accessibility tree themselves. Everything else they show is consumer content.
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

/** Returning `undefined` falls back to {@link LG_DEFAULT_LABELS}. */
export type LgLabelResolver = (key: keyof LgLabels) => string | undefined;

export const LG_LABELS = new InjectionToken<LgLabelResolver>('lg-labels');

/**
 * Supply localized stock strings once, app-wide; without it every component
 * falls back to English {@link LG_DEFAULT_LABELS}.
 *
 * Per-instance inputs (`closeLabel`, `dismissLabel`, …) still win, and are the
 * way to keep a **long-lived** surface correct across a language switch: a
 * resolver is consulted only while a component is being constructed.
 *
 * A resolver rather than a plain object because DI caches a factory's result
 * per injector, which would pin every label to the bootstrap language.
 * `resolverFactory` runs once; the resolver it returns runs per lookup.
 */
export function provideLgLabels(
  resolverFactory: () => LgLabelResolver
): Provider[] {
  return [{ provide: LG_LABELS, useFactory: resolverFactory }];
}

/**
 * Resolve one stock label for a component's `input()` default. Call it in a
 * field initializer, which runs inside the injection context.
 */
export function lgLabel(key: keyof LgLabels): string {
  const resolved = inject(LG_LABELS, { optional: true })?.(key);
  return resolved || LG_DEFAULT_LABELS[key];
}
