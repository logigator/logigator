import { computed, Injectable, signal } from '@angular/core';

export type LayoutBreakpoint = 'compact' | 'regular';

const COMPACT_QUERY = '(max-width: 64rem)';
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * Two orthogonal device axes:
 *
 * - `isTouch` (input) — touch capability, so hit targets can be finger-sized.
 *   Not a claim about the pointer in use: canvas input branches per event on
 *   `pointerType`, so a mouse on a touch device still takes the mouse path.
 * - `isCompact` (layout) — which chrome renders (desktop bars vs mobile HUD
 *   and sheets).
 *
 * Never collapse them into one "isMobile": a touch laptop is `isTouch &&
 * !isCompact`, a narrow desktop window is `!isTouch && isCompact`.
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
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
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
