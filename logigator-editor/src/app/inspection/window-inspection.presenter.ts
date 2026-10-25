import { computed, inject, Injectable, Signal } from '@angular/core';
import {
  LgHelpAction,
  WindowRect,
  WindowRef,
  WindowService,
  WindowTitlePart
} from '@logigator/ui';
import { DocumentationService } from '../documentation/documentation.service';
import {
  entryTitle,
  entryTitleParts,
  InspectionPresenter,
  OpenInspection
} from './inspection-presenter';

/** Default window size for inspections that bring no sizing of their own. */
const DEFAULT_SIZE = { width: 480, height: 400 };

/**
 * The desktop presenter: one floating {@link WindowService} window per
 * inspection, rendered into the `lg-window-outlet` over the board.
 */
@Injectable({ providedIn: 'root' })
export class WindowInspectionPresenter implements InspectionPresenter {
  private readonly windowService = inject(WindowService);
  private readonly documentation = inject(DocumentationService);
  private readonly refs = new Map<OpenInspection, WindowRef>();

  public show(entry: OpenInspection, dismissed: () => void): void {
    const { inspection } = entry;
    const ref = this.windowService.open(inspection.renderer, {
      title: entryTitle(entry),
      titleParts: this._titleParts(entry),
      help: this._help(entry),
      inputValues: { inspection },
      initialSize: inspection.sizing?.initial ?? DEFAULT_SIZE,
      minSize: inspection.sizing?.min,
      maxSize: inspection.sizing?.max
    });
    this.refs.set(entry, ref);
    // Fires on every teardown path; `close()` removes the map entry first, so
    // only user-driven closes reach the service.
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

  /**
   * The entry's window box in viewport CSS px — `null` when it is not framed by
   * a window, or its chrome is not in the DOM yet.
   */
  public boundsOf(entry: OpenInspection): WindowRect | null {
    return this.refs.get(entry)?.bounds ?? null;
  }

  /** Places the entry's window, clamped to the board it floats over. */
  public setBoundsOf(
    entry: OpenInspection,
    rect: Partial<WindowRect>
  ): WindowRect | null {
    return this.refs.get(entry)?.setBounds(rect) ?? null;
  }

  /** The title bar's help button, opening the inspection's docs section. */
  private _help(entry: OpenInspection): Signal<LgHelpAction> | undefined {
    const docs = entry.inspection.docs;
    return docs
      ? computed(() => this.documentation.helpAction(docs))
      : undefined;
  }

  /** Breadcrumb segments for the title bar (`navigate` → clickable). */
  private _titleParts(
    entry: OpenInspection
  ): Signal<readonly WindowTitlePart[]> | undefined {
    const parts = entryTitleParts(entry);
    if (!parts) {
      return undefined;
    }
    return computed(() =>
      parts().map((part) => ({ label: part.label, command: part.navigate }))
    );
  }
}
