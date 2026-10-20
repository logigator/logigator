import { NgTemplateOutlet } from '@angular/common';
import { DataSource } from '@angular/cdk/collections';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport
} from '@angular/cdk/scrolling';
import {
  AfterViewInit,
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
 * A host that loads what its rows show reads {@link renderedRangeChange}.
 * A host whose list is long and changes often hands over a `DataSource`
 * emitting the list, which the viewport reads without copying it.
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
export class LgScroller implements AfterViewInit {
  readonly items = input<readonly unknown[] | DataSource<unknown>>([]);
  readonly itemSize = input.required<number>();
  readonly scrollHeight = input<string>();
  readonly style = input<Record<string, string> | null>(null);
  readonly styleClass = input<string>('');
  /** `tabindex` of the viewport element — set to make it keyboard-scrollable. */
  readonly tabindex = input<string | null>(null);

  readonly scrolled = output<Event>();
  /**
   * The item indexes `[start, end)` the viewport has rendered — the rows on
   * screen plus the CDK's buffer — on every change: the first layout, a
   * scroll, a resize, a change of items.
   */
  readonly renderedRangeChange = output<{ start: number; end: number }>();

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

  ngAfterViewInit(): void {
    // Subscribed before the viewport's first layout, which runs on a
    // microtask after its init. The stream completes with the viewport.
    this.viewport().renderedRangeStream.subscribe(({ start, end }) =>
      this.renderedRangeChange.emit({ start, end })
    );
  }

  /** The scroll container element, for reading or driving the horizontal axis. */
  get viewportElement(): HTMLElement {
    return this.viewport().elementRef.nativeElement;
  }

  /**
   * Re-reads the viewport's size and scroll offset and renders the rows now
   * in view, for a host that moved `scrollTop` itself.
   */
  checkViewportSize(): void {
    this.viewport().checkViewportSize();
  }

  scrollToIndex(index: number, behavior?: ScrollBehavior): void {
    this.viewport().scrollToIndex(index, behavior);
  }
}
