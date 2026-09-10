import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  inject,
  input,
  model,
  TemplateRef
} from '@angular/core';
import { LgCollapse } from '../../internal/collapse';

/**
 * A disclosure accordion, its open panels tracked by `value` key in a two-way
 * `model()`. `multiple` allows several at once; otherwise opening one closes
 * the rest. Panels are vertically padded and horizontally flush, and a caller
 * wanting other padding sets it on its own projected content.
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
 * One panel of an {@link LgAccordion}, identified by `value`. The `#header`
 * template fills the clickable header; the projected body sits in an animated
 * {@link LgCollapse} region.
 */
@Component({
  selector: 'lg-accordion-panel',
  imports: [LgCollapse, NgTemplateOutlet],
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
    <lg-collapse [open]="open()">
      <div class="pb-4.5">
        <ng-content></ng-content>
      </div>
    </lg-collapse>
  `
})
export class LgAccordionPanel {
  readonly value = input.required<string>();

  protected readonly parent = inject(LgAccordion);
  protected readonly header = contentChild<TemplateRef<unknown>>('header');

  protected readonly open = computed(() => this.parent.isOpen(this.value()));
}
