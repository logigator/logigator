import { Injectable, signal } from '@angular/core';

/**
 * Reactive registry of onboarding target elements, keyed by a stable id (e.g.
 * `tool-wire`, `sim-controls`, `palette-item-2`). Elements register themselves
 * through {@link OnboardTargetDirective}; the hint and tutorial systems resolve
 * their anchors by reading {@link get} inside a computed/effect, so an anchor
 * appears — or re-anchors — reactively as its element enters, leaves, or is
 * re-created in the DOM, with no `querySelector` timing races.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingTargetRegistry {
  private readonly _targets = signal<ReadonlyMap<string, HTMLElement>>(
    new Map()
  );

  /**
   * Register (or replace) the element for `id`. Last registration wins. Uses
   * `update()` (a write, which never establishes a reactive dependency) so a
   * caller inside an `effect` — e.g. {@link OnboardTargetDirective} — does not
   * end up depending on the very signal it writes and looping forever.
   */
  public register(id: string, element: HTMLElement): void {
    this._targets.update((current) => {
      const next = new Map(current);
      next.set(id, element);
      return next;
    });
  }

  /**
   * Remove `id`'s entry, but only if it still points at `element`. During a
   * breakpoint flip the same id can briefly have two elements (e.g. the desktop
   * tool-bar and compact tool-hud copies of a tool button); the outgoing one
   * must not clobber the incoming registration. Returning the same map when
   * nothing matches is a no-op write (Object.is equal → no notification).
   */
  public unregister(id: string, element: HTMLElement): void {
    this._targets.update((current) => {
      if (current.get(id) !== element) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  /**
   * The element registered for `id`, or null. A reactive read — call it inside a
   * computed/effect to track the element as it comes and goes.
   */
  public get(id: string | null | undefined): HTMLElement | null {
    if (!id) return null;
    return this._targets().get(id) ?? null;
  }
}
