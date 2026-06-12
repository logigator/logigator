import { inject, Injectable } from '@angular/core';
import { ProjectMetadataStore } from './project-metadata.store';

/**
 * Registers a {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event | beforeunload}
 * listener that triggers the browser's built-in "leave site?" dialog when any
 * registered project has unsaved changes.
 *
 * The dialog text is controlled by the browser and cannot be customised.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard {
  private readonly metadataStore = inject(ProjectMetadataStore);
  private _attached = false;
  private _handler: ((e: BeforeUnloadEvent) => void) | null = null;

  /**
   * Registers the `beforeunload` listener.
   *
   * Idempotent — calling this when the listener is already attached is a no-op.
   */
  public attach(): void {
    if (this._attached) return;

    this._handler = (e: BeforeUnloadEvent): void => {
      if (this.metadataStore.anyDirty()) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', this._handler);
    this._attached = true;
  }

  /**
   * Removes the `beforeunload` listener.
   *
   * Idempotent — safe to call even if the listener was never attached or was
   * already detached.
   */
  public detach(): void {
    if (!this._attached || !this._handler) return;

    window.removeEventListener('beforeunload', this._handler);
    this._handler = null;
    this._attached = false;
  }
}
