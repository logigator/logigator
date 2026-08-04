import { effect, EffectRef, inject, Injectable, Injector } from '@angular/core';
import { ProjectMetadataStore } from './project-metadata.store';

/**
 * Registers a {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event | beforeunload}
 * listener that triggers the browser's built-in "leave site?" dialog when any
 * registered project has unsaved changes.
 *
 * The listener is bound and unbound as `anyDirty()` flips rather than kept for
 * the whole session: a registered `beforeunload` listener disqualifies the page
 * from the back/forward cache whether or not it ever fires, so an editor with
 * nothing to lose would otherwise trade bfcache — and a cold start on every
 * back-navigation — for nothing.
 *
 * The dialog text is controlled by the browser and cannot be customised.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard {
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly injector = inject(Injector);
  private _sync: EffectRef | null = null;
  private _handler: ((e: BeforeUnloadEvent) => void) | null = null;

  /** Starts following the dirty state. Idempotent. */
  public attach(): void {
    if (this._sync) return;

    this._sync = effect(
      () => {
        if (this.metadataStore.anyDirty()) {
          this._bind();
        } else {
          this._unbind();
        }
      },
      { injector: this.injector }
    );
  }

  /** Stops following the dirty state and removes the listener. Idempotent. */
  public detach(): void {
    this._sync?.destroy();
    this._sync = null;
    this._unbind();
  }

  private _bind(): void {
    if (this._handler) return;

    this._handler = (e: BeforeUnloadEvent): void => {
      // Re-checked rather than assumed from the listener's presence: effects are
      // scheduled, so a just-saved project can still have the listener bound.
      if (this.metadataStore.anyDirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', this._handler);
  }

  private _unbind(): void {
    if (!this._handler) return;

    window.removeEventListener('beforeunload', this._handler);
    this._handler = null;
  }
}
