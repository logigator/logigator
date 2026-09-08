import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LgCard } from '@logigator/ui';

/**
 * The frame the four auth pages share: one narrow card, centred, with the
 * page's heading and an optional lead above the content.
 *
 * The lead is rendered in the body rather than through the card's `#subtitle`
 * slot, so it can be conditional — a content query reaches a template the
 * consumer always declares, not one an `@if` may never create.
 */
@Component({
  selector: 'web-auth-shell',
  imports: [LgCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <lg-card>
        <ng-template #title>
          <h1>{{ heading() }}</h1>
        </ng-template>
        @if (lead()) {
          <p class="-mt-1 mb-4 text-muted">{{ lead() }}</p>
        }
        <ng-content />
      </lg-card>
    </section>
  `
})
export class AuthShell {
  readonly heading = input.required<string>();
  readonly lead = input<string>();
}
