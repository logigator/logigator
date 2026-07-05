import { computed, inject, Injectable, Signal } from '@angular/core';
import { WindowRef, WindowService, WindowTitlePart } from '@logigator/ui';
import { ComponentInspection } from '../components/component-inspection';
import { InspectionPresenter, OpenInspection } from './inspection-presenter';

/** Default window size for inspections that bring no sizing of their own. */
const DEFAULT_SIZE = { width: 480, height: 400 };

/**
 * The desktop presenter: one floating {@link WindowService} window per
 * inspection, rendered into the `lg-window-outlet` over the board. The
 * inspection model is handed to its renderer as the `inspection` input.
 */
@Injectable({ providedIn: 'root' })
export class WindowInspectionPresenter implements InspectionPresenter {
  private readonly windowService = inject(WindowService);
  private readonly refs = new Map<OpenInspection, WindowRef>();

  public show(entry: OpenInspection, dismissed: () => void): void {
    const { inspection } = entry;
    const ref = this.windowService.open(inspection.renderer, {
      title: inspection.title,
      titleParts: this._titleParts(inspection),
      inputValues: { inspection },
      initialSize: inspection.sizing?.initial ?? DEFAULT_SIZE,
      minSize: inspection.sizing?.min,
      maxSize: inspection.sizing?.max
    });
    this.refs.set(entry, ref);
    // Fires on every teardown path; `close()` below removes the map entry
    // first, so only user-driven closes reach the service.
    ref.onClose.subscribe(() => {
      if (this.refs.delete(entry)) {
        dismissed();
      }
    });
  }

  public focus(entry: OpenInspection): void {
    this.refs.get(entry)?.focus();
  }

  public close(entry: OpenInspection): void {
    const ref = this.refs.get(entry);
    this.refs.delete(entry);
    ref?.close();
  }

  /** Breadcrumb segments for the title bar (`navigate` → clickable). */
  private _titleParts(
    inspection: ComponentInspection
  ): Signal<readonly WindowTitlePart[]> | undefined {
    const parts = inspection.titleParts;
    if (!parts) {
      return undefined;
    }
    return computed(() =>
      parts().map((part) => ({ label: part.label, command: part.navigate }))
    );
  }
}
