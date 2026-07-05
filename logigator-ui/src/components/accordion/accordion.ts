import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  signal,
  TemplateRef
} from '@angular/core';

/**
 * A disclosure accordion. Open panels are tracked by their `value` keys in a
 * `model()` `string[]` (two-way bindable). `multiple` allows several open at
 * once; otherwise opening one closes the rest. Panels are vertically padded and
 * flush horizontally (the side-bar layout); a caller wanting different padding
 * sets it on its own projected header/content.
 */
@Component({
  selector: 'lg-accordion',
  host: { class: 'block' },
  template: '<ng-content></ng-content>'
})
export class LgAccordion {
  readonly value = model<string[]>([]);
  readonly multiple = input(false, { transform: booleanAttribute });

  isOpen(panel: string): boolean {
    return this.value().includes(panel);
  }

  toggle(panel: string): void {
    const open = this.value();
    if (open.includes(panel)) {
      this.value.set(open.filter((v) => v !== panel));
    } else {
      this.value.set(this.multiple() ? [...open, panel] : [panel]);
    }
  }
}

/**
 * One panel of an {@link LgAccordion}. Identified by `value`; renders the
 * `#header` template in the clickable header (with a caret) and its projected
 * body in an animated height-collapsing region. A bottom divider separates
 * panels; the last panel drops it automatically (`last:border-b-0`).
 *
 * The body clips its overflow only while closed or mid-animation (so the
 * height collapse hides the content); once fully open it stops clipping, so
 * projected content is free to bleed past the panel bounds — focus rings,
 * corner badges — without the consumer padding it away from the edges.
 * Horizontal overflow is never clipped (the collapse is purely vertical).
 */
@Component({
  selector: 'lg-accordion-panel',
  imports: [NgTemplateOutlet],
  host: { class: 'block border-b border-border last:border-b-0' },
  template: `
    <button
      type="button"
      class="flex w-full items-center py-4.5 text-left"
      [attr.aria-expanded]="open()"
      (click)="parent.toggle(value())"
    >
      <ng-container *ngTemplateOutlet="header() ?? null"></ng-container>
      <i
        class="ph ph-caret-down shrink-0 transition-transform duration-200"
        [class.rotate-180]="open()"
        aria-hidden="true"
      ></i>
    </button>
    <div
      class="grid transition-[grid-template-rows] duration-200"
      [style.grid-template-rows]="open() ? '1fr' : '0fr'"
      (transitionend)="onTransitionEnd($event)"
    >
      <div
        class="min-h-0 overflow-x-visible"
        [class.overflow-y-clip]="clipped()"
      >
        <div class="pb-4.5">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class LgAccordionPanel {
  readonly value = input.required<string>();

  protected readonly parent = inject(LgAccordion);
  protected readonly header = contentChild<TemplateRef<unknown>>('header');

  protected readonly open = computed(() => this.parent.isOpen(this.value()));

  /** True while the open/close height transition is running. */
  private readonly animating = signal(false);

  /**
   * Clip the body while it is closed or animating so the collapse hides the
   * content; leave a fully-open panel unclipped so projected content can
   * overflow the bounds.
   */
  protected readonly clipped = computed(() => !this.open() || this.animating());

  constructor() {
    let initialized = false;
    effect(() => {
      // Track open state. Skip the initial run: a panel that starts open has
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
