import { NgTemplateOutlet } from '@angular/common';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport
} from '@angular/cdk/scrolling';
import {
  Component,
  contentChild,
  input,
  output,
  TemplateRef,
  viewChild
} from '@angular/core';

/**
 * Fixed-size virtual scroller over `cdk/scrolling`. Renders only the visible
 * window of `items` (each `itemSize` px tall) inside a `scrollHeight`-tall
 * viewport, projecting the `#item` template per row (`$implicit` = the item).
 * Exposes {@link scrollToIndex} (obtained via `viewChild`). Vertical, fixed-size
 * only — no lazy mode or autosize.
 *
 * Only the vertical axis is virtualized, but the viewport is a regular
 * two-axis scroll container: rows wider than it overflow horizontally without
 * growing it (the CDK content wrapper is absolutely positioned). Hosts that
 * drive or mirror that horizontal axis get the raw scroll events via
 * {@link scrolled} and the container itself via {@link viewportElement}.
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

  /** Native `scroll` events of the viewport element (both axes). */
  readonly scrolled = output<Event>();

  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);

  /** The scroll container element, for reading or driving the horizontal axis. */
  get viewportElement(): HTMLElement {
    return this.viewport().elementRef.nativeElement;
  }

  /** Scroll the row at `index` into view. */
  scrollToIndex(index: number, behavior?: ScrollBehavior): void {
    this.viewport().scrollToIndex(index, behavior);
  }
}
