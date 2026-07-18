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

  /** Register (or replace) the element for `id`. Last registration wins. */
  public register(id: string, element: HTMLElement): void {
    const next = new Map(this._targets());
    next.set(id, element);
    this._targets.set(next);
  }

  /**
   * Remove `id`'s entry, but only if it still points at `element`. During a
   * breakpoint flip the same id can briefly have two elements (e.g. the desktop
   * tool-bar and compact tool-hud copies of a tool button); the outgoing one
   * must not clobber the incoming registration.
   */
  public unregister(id: string, element: HTMLElement): void {
    if (this._targets().get(id) !== element) return;
    const next = new Map(this._targets());
    next.delete(id);
    this._targets.set(next);
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
