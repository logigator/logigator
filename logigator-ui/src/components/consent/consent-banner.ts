import { Component, input, output } from '@angular/core';
import { LgButton } from '../button/button';
import { LgConsentCopy, optionalCategoryIds } from './consent-copy';

let nextId = 0;

/**
 * The consent question, as a bar across the bottom of the viewport. It does not
 * block the page: a visitor may read on and answer later, and the page stays
 * usable underneath.
 *
 * Whether it shows is the consumer's call, and so is recording the answer —
 * the library knows nothing of cookies. `decide` carries the categories
 * granted, required ones never among them; `customize` asks the consumer to
 * open {@link LgConsentPreferences}.
 *
 * Nothing here touches a browser global, so a server render emits the bar in
 * the first byte and the page does not shift when it hydrates. It rises in
 * from the bottom edge once, when it first appears.
 */
@Component({
  selector: 'lg-consent-banner',
  imports: [LgButton],
  host: {
    role: 'region',
    '[attr.aria-labelledby]': 'titleId',
    class:
      'fixed inset-x-0 bottom-0 z-banner block border-t border-border bg-content text-text shadow-[0_-4px_16px_rgb(0_0_0/0.08)]'
  },
  template: `
    <div
      class="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row md:items-center md:gap-8 md:px-6"
    >
      <div class="min-w-0 flex-1">
        <h2 [id]="titleId" class="font-semibold">{{ copy().title }}</h2>
        <p class="mt-1 text-sm text-muted">
          {{ copy().text }}
          <a
            class="text-primary underline underline-offset-2 hover:text-primary-emphasis"
            target="_blank"
            rel="noopener"
            [href]="copy().privacyHref"
            >{{ copy().privacyLabel }}</a
          >
        </p>
      </div>
      <div class="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">
        <button
          lgButton
          text
          severity="secondary"
          class="max-md:flex-1"
          (onClick)="customize.emit()"
        >
          {{ copy().customize }}
        </button>
        <button
          lgButton
          outlined
          severity="secondary"
          class="max-md:flex-1"
          (onClick)="decide.emit([])"
        >
          {{ copy().rejectAll }}
        </button>
        <button lgButton class="max-md:basis-full" (onClick)="acceptAll()">
          {{ copy().acceptAll }}
        </button>
      </div>
    </div>
  `,
  // A keyframe animation rather than an enter transition: it plays on the first
  // paint of server-rendered markup with no script, and hydration adopts the
  // element instead of recreating it, so it does not play a second time.
  styles: `
    :host {
      animation: lg-consent-rise 300ms ease-out;
    }
    @keyframes lg-consent-rise {
      from {
        transform: translateY(100%);
      }
    }
  `
})
export class LgConsentBanner {
  readonly copy = input.required<LgConsentCopy>();

  readonly decide = output<readonly string[]>();
  readonly customize = output<void>();

  protected readonly titleId = `lg-consent-banner-${++nextId}`;

  protected acceptAll(): void {
    this.decide.emit(optionalCategoryIds(this.copy()));
  }
}
