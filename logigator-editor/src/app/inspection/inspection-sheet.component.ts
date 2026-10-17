import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { LgDrawer } from '@logigator/ui';
import { entryTitle, OpenInspection } from './inspection-presenter';
import { SheetInspectionPresenter } from './sheet-inspection.presenter';

/**
 * The compact inspection sheet: a non-modal bottom drawer over the running
 * simulation — no scrim and no focus trap, so the canvas above stays live. One
 * view at a time; a tab row switches between several.
 *
 * The sheet's height is set on the drawer's panel rather than on the view, so
 * the view shrinks with the panel's cap when an on-screen keyboard leaves
 * less room; the extra 5.5rem is the drawer's header and padding.
 *
 * The view is keyed by its entry, so switching tabs destroys one view and
 * builds the next, even between two inspections sharing a renderer: a view
 * is bound to the inspection it was built for, and never handed another.
 */
@Component({
  selector: 'app-inspection-sheet',
  imports: [LgDrawer, NgComponentOutlet],
  template: `
    <lg-drawer
      position="bottom"
      [modal]="false"
      [visible]="presenter.entries().length > 0"
      (visibleChange)="onVisibleChange($event)"
      [header]="title()"
      styleClass="h-[calc(45dvh+5.5rem)]"
    >
      <div class="flex h-full flex-col gap-2">
        @if (presenter.entries().length > 1) {
          <div class="flex shrink-0 gap-1 overflow-x-auto">
            @for (entry of presenter.entries(); track entry) {
              <button
                type="button"
                class="shrink-0 rounded-md border px-3 py-1 text-sm transition-colors"
                [class]="
                  entry === presenter.active()
                    ? 'border-primary-500 bg-primary-500/15 text-primary-700 dark:text-primary-300'
                    : 'border-border text-muted hover:bg-content-hover hover:text-text'
                "
                (click)="presenter.focus(entry)"
              >
                {{ entry.inspection.title() }}
              </button>
            }
          </div>
        }
        @for (active of shown(); track active) {
          <div class="min-h-0 grow">
            <ng-container
              *ngComponentOutlet="
                active.inspection.renderer;
                inputs: { inspection: active.inspection }
              "
            />
          </div>
        }
      </div>
    </lg-drawer>
  `
})
export class InspectionSheetComponent {
  protected readonly presenter = inject(SheetInspectionPresenter);

  /** The active entry, as the one-element list the view is keyed by. */
  protected readonly shown = computed<readonly OpenInspection[]>(() => {
    const active = this.presenter.active();
    return active ? [active] : [];
  });

  protected readonly title = computed(() => {
    const active = this.presenter.active();
    return active ? entryTitle(active)() : '';
  });

  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.presenter.dismissAll();
    }
  }
}
