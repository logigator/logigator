import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The one object every empty list on the site uses: a short heading, one line,
 * and at most one projected action. Which kind of emptiness it is — nothing
 * yet, nothing found, nothing here — is the caller's words, not a mode.
 */
@Component({
  selector: 'web-empty-state',
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center gap-2.5 px-5 py-13 text-center">
      <p class="text-[17px] font-medium text-text-hover">{{ heading() }}</p>
      <p class="max-w-[40ch] text-sm leading-relaxed text-muted">
        {{ body() }}
      </p>
      <div class="mt-2 empty:hidden"><ng-content /></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
}
