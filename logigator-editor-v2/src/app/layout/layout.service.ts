import { computed, Injectable, signal } from '@angular/core';

export type LayoutBreakpoint = 'compact' | 'regular';

/** Below Tailwind's `md` (768px). Mobile chrome renders under this width. */
const COMPACT_QUERY = '(max-width: 767.98px)';
/** A finger / pen rather than a precise mouse pointer. */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * The two orthogonal device axes the editor adapts to:
 *
 * - `isTouch` (input) — drives the multi-touch gesture layer and the touch
 *   branch of canvas input.
 * - `isCompact` (layout) — drives which Angular chrome renders (desktop bars
 *   vs. mobile HUD + sheets).
 *
 * They are deliberately separate: a touch laptop is `isTouch && !isCompact`,
 * a narrow desktop window is `!isTouch && isCompact`. Never collapse them into
 * a single "isMobile" flag.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly _isCompact = signal(this._matches(COMPACT_QUERY));
  private readonly _isTouch = signal(this._detectTouch());

  public readonly isCompact = computed(this._isCompact);
  public readonly isTouch = computed(this._isTouch);
  public readonly breakpoint = computed<LayoutBreakpoint>(() =>
    this._isCompact() ? 'compact' : 'regular'
  );

  constructor() {
    // Root singleton: listeners live for the app's lifetime, so no teardown.
    this._mql(COMPACT_QUERY)?.addEventListener('change', (e) =>
      this._isCompact.set(e.matches)
    );
    this._mql(COARSE_POINTER_QUERY)?.addEventListener('change', () =>
      this._isTouch.set(this._detectTouch())
    );
  }

  private _mql(query: string): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return null;
    }
    return window.matchMedia(query);
  }

  private _matches(query: string): boolean {
    return this._mql(query)?.matches ?? false;
  }

  private _detectTouch(): boolean {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
      return true;
    }
    return this._matches(COARSE_POINTER_QUERY);
  }
}
