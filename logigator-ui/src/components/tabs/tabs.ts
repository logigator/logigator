import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model
} from '@angular/core';

/**
 * DI handle a tab/panel uses to talk to its parent {@link LgTabs} without a
 * circular class reference. Provided by `LgTabs`.
 */
export abstract class LgTabsRef {
  abstract isActive(value: string): boolean;
  abstract select(value: string): void;
  abstract onKeydown(event: KeyboardEvent): void;
}

/**
 * A tab button in the tablist. The active one draws the underline, a bottom
 * border overlapping the tablist's via `-mb-px`.
 */
@Component({
  selector: 'lg-tab',
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      role="tab"
      [class]="classes()"
      [attr.aria-selected]="active()"
      [attr.tabindex]="active() ? 0 : -1"
      [disabled]="disabled()"
      (click)="parent.select(value())"
      (keydown)="parent.onKeydown($event)"
    >
      <ng-content></ng-content>
    </button>
  `
})
export class LgTab {
  readonly value = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly parent = inject(LgTabsRef);
  protected readonly active = computed(() =>
    this.parent.isActive(this.value())
  );

  protected readonly classes = computed(() =>
    [
      '-mb-px border-b-2 px-4 py-2 font-medium transition-colors',
      'disabled:pointer-events-none disabled:opacity-50',
      this.active()
        ? 'border-primary text-primary'
        : 'border-transparent text-muted hover:text-text'
    ].join(' ')
  );
}

/**
 * A tab's content. Stays in the DOM (hidden when inactive) so panel state is
 * preserved across tab switches.
 */
@Component({
  selector: 'lg-tab-panel',
  host: { role: 'tabpanel', '[hidden]': '!active()' },
  template: '<ng-content></ng-content>'
})
export class LgTabPanel {
  readonly value = input.required<string>();

  protected readonly parent = inject(LgTabsRef);
  protected readonly active = computed(() =>
    this.parent.isActive(this.value())
  );
}

/**
 * A tab set. `value` is a two-way `model()` of the active tab's key. Tabs and
 * panels are projected in any order; roving reads the rendered `[role=tab]`
 * buttons.
 */
@Component({
  selector: 'lg-tabs',
  host: { class: 'block' },
  providers: [{ provide: LgTabsRef, useExisting: forwardRef(() => LgTabs) }],
  template: `
    <div role="tablist" class="flex border-b border-border">
      <ng-content select="lg-tab"></ng-content>
    </div>
    <div class="pt-3">
      <ng-content select="lg-tab-panel"></ng-content>
    </div>
  `
})
export class LgTabs extends LgTabsRef {
  readonly value = model<string>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  override isActive(value: string): boolean {
    return this.value() === value;
  }

  override select(value: string): void {
    this.value.set(value);
  }

  override onKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    const tabs = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        '[role=tab]:not([disabled])'
      )
    );
    if (!tabs.length) {
      return;
    }
    const current = tabs.findIndex(
      (t) => t.getAttribute('aria-selected') === 'true'
    );
    const base = current < 0 ? 0 : current;
    let next = base;
    switch (event.key) {
      case 'ArrowRight':
        next = (base + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (base - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
    }
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }
}
