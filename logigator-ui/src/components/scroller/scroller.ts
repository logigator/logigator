import { NgTemplateOutlet } from '@angular/common';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport
} from '@angular/cdk/scrolling';
import {
  afterNextRender,
  Component,
  contentChild,
  DestroyRef,
  inject,
  input,
  output,
  TemplateRef,
  viewChild
} from '@angular/core';

/**
 * Fixed-size virtual scroller over `cdk/scrolling`, projecting the `#item`
 * template per visible row. Vertical and fixed-size only: no lazy mode, no
 * autosize.
 *
 * Only the vertical axis is virtualized, but the viewport is a regular
 * two-axis scroll container — rows wider than it overflow horizontally
 * without growing it, since the CDK content wrapper is absolutely positioned.
 * A host driving that axis reads {@link scrolled} and {@link viewportElement}.
 */
@Component({
  selector: 'lg-scroller',
  imports: [
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    NgTemplateOutlet
  ],
  host: { class: 'block' },
  template: `
    <cdk-virtual-scroll-viewport
      [itemSize]="itemSize()"
      [style.height]="scrollHeight()"
      [style]="style()"
      [class]="styleClass()"
      [attr.tabindex]="tabindex()"
      (scroll)="scrolled.emit($event)"
    >
      <div *cdkVirtualFor="let item of items()">
        <ng-container
          *ngTemplateOutlet="
            itemTemplate() ?? null;
            context: { $implicit: item }
          "
        ></ng-container>
      </div>
    </cdk-virtual-scroll-viewport>
  `
})
export class LgScroller {
  readonly items = input<readonly unknown[]>([]);
  readonly itemSize = input.required<number>();
  readonly scrollHeight = input<string>();
  readonly style = input<Record<string, string> | null>(null);
  readonly styleClass = input<string>('');
  /** `tabindex` of the viewport element — set to make it keyboard-scrollable. */
  readonly tabindex = input<string | null>(null);

  readonly scrolled = output<Event>();

  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);

  constructor() {
    // The CDK viewport re-measures only on window resize, not when its own
    // container grows. Without this it keeps rendering the rows that filled
    // the first-render height and leaves the grown space empty.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Guarded for test environments without ResizeObserver.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() =>
        this.viewport().checkViewportSize()
      );
      observer.observe(this.viewportElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** The scroll container element, for reading or driving the horizontal axis. */
  get viewportElement(): HTMLElement {
    return this.viewport().elementRef.nativeElement;
  }

  scrollToIndex(index: number, behavior?: ScrollBehavior): void {
    this.viewport().scrollToIndex(index, behavior);
  }
}
