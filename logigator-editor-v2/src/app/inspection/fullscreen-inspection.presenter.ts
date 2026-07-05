import { computed, Injectable, signal } from '@angular/core';
import { InspectionPresenter, OpenInspection } from './inspection-presenter';

interface FullscreenEntry {
  readonly entry: OpenInspection;
  readonly dismissed: () => void;
}

/**
 * The compact presenter for `compactPresentation: 'fullscreen'` inspections
 * (watches): a full-viewport takeover rendered by
 * {@link FullscreenInspectionComponent}. One takeover is visible at a time —
 * presenting another entry stacks over the current one (which stays open
 * underneath); the back button dismisses the visible entry, revealing the
 * previous one, or the board when the stack empties.
 */
@Injectable({ providedIn: 'root' })
export class FullscreenInspectionPresenter implements InspectionPresenter {
  private readonly _entries = signal<readonly FullscreenEntry[]>([]);

  /** The entry whose takeover is visible (top of the stack). */
  public readonly visible = computed(
    () => this._entries().at(-1)?.entry ?? null
  );

  public show(entry: OpenInspection, dismissed: () => void): void {
    this._entries.update((entries) => [...entries, { entry, dismissed }]);
  }

  public focus(entry: OpenInspection): void {
    this._entries.update((entries) => {
      const found = entries.find((candidate) => candidate.entry === entry);
      if (!found) {
        return entries;
      }
      return [...entries.filter((candidate) => candidate !== found), found];
    });
  }

  public close(entry: OpenInspection): void {
    this._entries.update((entries) =>
      entries.filter((candidate) => candidate.entry !== entry)
    );
  }

  /** The user tapped back: the visible entry's inspection closes with it. */
  public dismissVisible(): void {
    const top = this._entries().at(-1);
    if (!top) {
      return;
    }
    this._entries.update((entries) => entries.slice(0, -1));
    top.dismissed();
  }
}
