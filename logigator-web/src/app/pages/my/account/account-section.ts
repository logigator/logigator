import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One block of the account page. The page is a stack of these rather than a
 * route each: nothing here is indexable — the whole subtree answers a `302` to
 * a visitor with no session — so the crawler argument that split a public
 * profile into four routes does not apply, and each block is one short form.
 */
@Component({
  selector: 'web-account-section',
  host: { class: 'block' },
  template: `
    <section class="rounded-md border border-border bg-content p-5 md:p-6">
      <h2 class="text-[17px] font-semibold text-text-hover">{{ heading() }}</h2>
      <p class="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
        {{ description() }}
      </p>
      <div class="mt-5"><ng-content /></div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSection {
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
}
