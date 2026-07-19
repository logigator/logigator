import { Component, computed, effect, input, signal } from '@angular/core';

/**
 * Internal animated vertical-collapse region: the shared idiom behind
 * accordion panels, panel-menu groups, and navigation groups. Collapsing
 * animates `grid-template-rows` between `1fr` and `0fr`, so the content needs
 * no measured height.
 *
 * The body clips its overflow while closed or mid-animation (so the height
 * collapse hides the content); once fully open it stops clipping, so projected
 * content — focus rings, corner badges — can bleed past the region's bounds.
 * Horizontal overflow is never clipped (the collapse is purely vertical).
 */
@Component({
  selector: 'lg-collapse',
  host: {
    class: 'grid transition-[grid-template-rows] duration-200',
    '[style.grid-template-rows]': `open() ? '1fr' : '0fr'`,
    '(transitionend)': 'onTransitionEnd($event)'
  },
  template: `
    <div class="min-h-0 overflow-x-visible" [class.overflow-y-clip]="clipped()">
      <ng-content></ng-content>
    </div>
  `
})
export class LgCollapse {
  readonly open = input.required<boolean>();

  /** True while the open/close height transition is running. */
  private readonly animating = signal(false);

  /**
   * Clip the body while it is closed or animating so the collapse hides the
   * content; leave a fully-open region unclipped so projected content can
   * overflow the bounds.
   */
  protected readonly clipped = computed(() => !this.open() || this.animating());

  constructor() {
    let initialized = false;
    effect(() => {
      // Track open state. Skip the initial run: a region that starts open has
      // no transition to wait on and must render unclipped straight away.
      this.open();
      if (!initialized) {
        initialized = true;
        return;
      }
      // A toggle started the height transition; clip through it until it ends.
      this.animating.set(true);
    });
  }

  protected onTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName === 'grid-template-rows') {
      this.animating.set(false);
    }
  }
}
