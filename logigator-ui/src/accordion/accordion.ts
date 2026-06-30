import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  model,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
 */
@Component({
  selector: 'lg-accordion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        class="ph ph-caret-down ml-2 shrink-0 transition-transform duration-200"
        [class.rotate-180]="open()"
        aria-hidden="true"
      ></i>
    </button>
    <div
      class="grid transition-[grid-template-rows] duration-200"
      [style.grid-template-rows]="open() ? '1fr' : '0fr'"
    >
      <div class="min-h-0 overflow-hidden pb-4.5">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class LgAccordionPanel {
  readonly value = input.required<string>();

  protected readonly parent = inject(LgAccordion);
  protected readonly header = contentChild<TemplateRef<unknown>>('header');

  protected readonly open = computed(() => this.parent.isOpen(this.value()));
}
