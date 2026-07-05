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
  TemplateRef,
  viewChild
} from '@angular/core';

/**
 * Fixed-size virtual scroller over `cdk/scrolling`. Renders only the visible
 * window of `items` (each `itemSize` px tall) inside a `scrollHeight`-tall
 * viewport, projecting the `#item` template per row (`$implicit` = the item).
 * Exposes {@link scrollToIndex} (obtained via `viewChild`). Vertical, fixed-size
 * only — no lazy mode or autosize.
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

  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);

  /** Scroll the row at `index` into view. */
  scrollToIndex(index: number, behavior?: ScrollBehavior): void {
    this.viewport().scrollToIndex(index, behavior);
  }
}
