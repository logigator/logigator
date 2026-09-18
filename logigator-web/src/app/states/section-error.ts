import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core';
import { LgButton } from '@logigator/ui';

/**
 * One read failed while the rest of the page rendered. The failure stays in
 * that read's own slot with a retry; everything the page rather than the API
 * supplied stays where it is.
 */
@Component({
  selector: 'web-section-error',
  imports: [LgButton],
  host: { class: 'block' },
  template: `
    <div
      class="flex gap-3 rounded-md border border-error-border bg-error-surface p-4"
      role="alert"
    >
      <i
        class="ph ph-warning-circle mt-px shrink-0 text-lg text-error"
        aria-hidden="true"
      ></i>
      <div class="flex min-w-0 flex-col items-start gap-1.5">
        <p class="font-medium text-text-hover">{{ heading() }}</p>
        <p class="max-w-[56ch] text-sm leading-relaxed text-muted">
          {{ message() }}
        </p>
        <button
          lgButton
          outlined
          severity="secondary"
          size="sm"
          type="button"
          class="mt-1.5"
          [loading]="retrying()"
          (click)="retry.emit()"
        >
          {{ retryLabel() }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionError {
  /** Names the thing that could not be loaded, not the failure in general. */
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly retryLabel = input.required<string>();
  readonly retrying = input(false, { transform: booleanAttribute });

  readonly retry = output<void>();
}
