import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgButton } from '@logigator/ui';
import { FullscreenInspectionPresenter } from './fullscreen-inspection.presenter';

/**
 * The compact fullscreen takeover: hosts the visible fullscreen inspection
 * (a watch) over the whole viewport, above the board chrome and the
 * inspection sheet, framed by a header with a back button and the live
 * title. Rendering the inspection uses the same `inspection` input contract
 * as the window and sheet presenters.
 */
@Component({
  selector: 'app-fullscreen-inspection',
  imports: [LgButton, NgComponentOutlet, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (presenter.visible(); as active) {
      <!-- Above the sheet/drawer overlays (z 1000), below toasts (z 1100). -->
      <div
        *transloco="let t"
        class="bg-content fixed inset-0 z-1050 flex flex-col"
      >
        <div class="border-border flex h-12 items-center gap-1 border-b px-1">
          <lg-button
            icon="ph ph-arrow-left"
            severity="secondary"
            text
            [ariaLabel]="t('inspection.back')"
            (onClick)="presenter.dismissVisible()"
          ></lg-button>
          @if (activeParts(); as parts) {
            <span
              class="flex min-w-0 grow flex-wrap items-center gap-1 px-1 font-semibold"
            >
              @for (part of parts; track $index; let last = $last) {
                @if (part.navigate; as navigate) {
                  <button
                    type="button"
                    class="text-muted hover:text-text truncate hover:underline"
                    (click)="navigate()"
                  >
                    {{ part.label }}
                  </button>
                } @else {
                  <span class="truncate">{{ part.label }}</span>
                }
                @if (!last) {
                  <span class="text-muted">›</span>
                }
              }
            </span>
          } @else {
            <span class="grow truncate px-1 font-semibold">
              {{ active.inspection.title() }}
            </span>
          }
        </div>
        <div class="min-h-0 grow">
          <ng-container
            *ngComponentOutlet="
              active.inspection.renderer;
              inputs: { inspection: active.inspection }
            "
          />
        </div>
      </div>
    }
  `
})
export class FullscreenInspectionComponent {
  protected readonly presenter = inject(FullscreenInspectionPresenter);

  /** Breadcrumb segments of the visible inspection, `null` for plain titles. */
  protected readonly activeParts = computed(() => {
    const parts = this.presenter.visible()?.inspection.titleParts?.();
    return parts && parts.length > 0 ? parts : null;
  });
}
