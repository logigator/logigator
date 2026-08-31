import { Injectable, signal } from '@angular/core';

/**
 * Reactive registry of onboarding target elements, keyed by a stable id (e.g.
 * `tool-wire`, `palette-item-2`). The hint and tutorial systems resolve their
 * anchors by reading {@link OnboardingTargetRegistry.get} inside a
 * computed/effect, so an anchor re-anchors as its element enters, leaves or is
 * re-created in the DOM, with no `querySelector` timing races.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingTargetRegistry {
  private readonly _targets = signal<ReadonlyMap<string, HTMLElement>>(
    new Map()
  );

  /**
   * Register (or replace) the element for `id`; last registration wins.
   * `update()` is a pure write, so a caller inside an `effect` does not end up
   * depending on the very signal it writes and looping forever.
   */
  public register(id: string, element: HTMLElement): void {
    this._targets.update((current) => {
      const next = new Map(current);
      next.set(id, element);
      return next;
    });
  }

  /**
   * Remove `id`'s entry, but only if it still points at `element`. A breakpoint
   * flip briefly gives one id two elements, and the outgoing one must not
   * clobber the incoming registration. Returning the same map is a no-op write.
   */
  public unregister(id: string, element: HTMLElement): void {
    this._targets.update((current) => {
      if (current.get(id) !== element) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  /** The element registered for `id`, or null. A reactive read. */
  public get(id: string | null | undefined): HTMLElement | null {
    if (!id) return null;
    return this._targets().get(id) ?? null;
  }
}
