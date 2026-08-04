import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { LgDrawer } from '@logigator/ui';
import { SheetInspectionPresenter } from './sheet-inspection.presenter';

/**
 * The compact inspection sheet: a non-modal bottom drawer over the running
 * simulation — no scrim and no focus trap, so the canvas above it stays live.
 * One inspection view at a time; a tab row switches between several. Closing
 * the sheet (✕ / Escape) dismisses every inspection in it.
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
    >
      <div class="flex h-[45dvh] flex-col gap-2">
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
        @if (presenter.active(); as active) {
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

  protected readonly title = computed(
    () => this.presenter.active()?.inspection.title() ?? ''
  );

  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.presenter.dismissAll();
    }
  }
}
