import { computed, Injectable, signal } from '@angular/core';
import { InspectionPresenter, OpenInspection } from './inspection-presenter';

interface SheetEntry {
  readonly entry: OpenInspection;
  readonly dismissed: () => void;
}

/**
 * The compact presenter: every open inspection shares the single non-modal
 * bottom sheet ({@link InspectionSheetComponent}) — one active view, a tab row
 * when several are open. This service holds the sheet's state; the component
 * renders it. Closing the sheet dismisses every inspection in it.
 */
@Injectable({ providedIn: 'root' })
export class SheetInspectionPresenter implements InspectionPresenter {
  private readonly _entries = signal<readonly SheetEntry[]>([]);
  /** The presented inspections, in opening order. */
  public readonly entries = computed(() =>
    this._entries().map((sheetEntry) => sheetEntry.entry)
  );

  private readonly _active = signal<OpenInspection | null>(null);
  /** The inspection whose view fills the sheet. */
  public readonly active = this._active.asReadonly();

  public show(entry: OpenInspection, dismissed: () => void): void {
    this._entries.update((entries) => [...entries, { entry, dismissed }]);
    this._active.set(entry);
  }

  public focus(entry: OpenInspection): void {
    if (this.entries().includes(entry)) {
      this._active.set(entry);
    }
  }

  public close(entry: OpenInspection): void {
    this._entries.update((entries) =>
      entries.filter((sheetEntry) => sheetEntry.entry !== entry)
    );
    if (this._active() === entry) {
      this._active.set(this.entries().at(-1) ?? null);
    }
  }

  /** The user closed the sheet: every inspection in it goes with it. */
  public dismissAll(): void {
    const entries = this._entries();
    this._entries.set([]);
    this._active.set(null);
    for (const { dismissed } of entries) {
      dismissed();
    }
  }
}
