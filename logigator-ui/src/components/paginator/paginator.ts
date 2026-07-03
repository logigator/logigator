import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';

/** Emitted on page change. Consumers typically read only `page`. */
export interface LgPaginatorState {
  page: number;
  first: number;
  rows: number;
  pageCount: number;
}

const MAX_LINKS = 5;

const NAV_CLASS =
  'flex size-9 items-center justify-center rounded-md text-muted ' +
  'hover:bg-content-hover hover:text-text disabled:pointer-events-none disabled:opacity-40';

/**
 * A page navigator: first/prev, a window of numbered links, next/last.
 * Stateless — driven by `first`/`rows`/`totalRecords` and emitting
 * `onPageChange` (the consumer owns the page state). Skips rows-per-page,
 * jump-to-page and current-page report.
 */
@Component({
  selector: 'lg-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center justify-center gap-1" role="navigation">
      <button
        type="button"
        [class]="navClass"
        [disabled]="currentPage() === 0"
        (click)="toPage(0)"
        aria-label="First page"
      >
        <i class="ph ph-caret-double-left"></i>
      </button>
      <button
        type="button"
        [class]="navClass"
        [disabled]="currentPage() === 0"
        (click)="toPage(currentPage() - 1)"
        aria-label="Previous page"
      >
        <i class="ph ph-caret-left"></i>
      </button>

      @for (p of pages(); track p) {
        <button
          type="button"
          [class]="pageClass(p === currentPage())"
          [attr.aria-current]="p === currentPage() ? 'page' : null"
          (click)="toPage(p)"
        >
          {{ p + 1 }}
        </button>
      }

      <button
        type="button"
        [class]="navClass"
        [disabled]="currentPage() >= pageCount() - 1"
        (click)="toPage(currentPage() + 1)"
        aria-label="Next page"
      >
        <i class="ph ph-caret-right"></i>
      </button>
      <button
        type="button"
        [class]="navClass"
        [disabled]="currentPage() >= pageCount() - 1"
        (click)="toPage(pageCount() - 1)"
        aria-label="Last page"
      >
        <i class="ph ph-caret-double-right"></i>
      </button>
    </div>
  `
})
export class LgPaginator {
  readonly first = input(0);
  readonly rows = input(10);
  readonly totalRecords = input(0);

  readonly onPageChange = output<LgPaginatorState>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / Math.max(1, this.rows())))
  );

  protected readonly currentPage = computed(() =>
    Math.max(
      0,
      Math.min(
        Math.floor(this.first() / Math.max(1, this.rows())),
        this.pageCount() - 1
      )
    )
  );

  // A window of up to MAX_LINKS page numbers centered on the current page.
  protected readonly pages = computed(() => {
    const count = this.pageCount();
    const current = this.currentPage();
    const start = Math.max(
      0,
      Math.min(current - Math.floor(MAX_LINKS / 2), count - MAX_LINKS)
    );
    const end = Math.min(count, start + MAX_LINKS);
    const result: number[] = [];
    for (let i = start; i < end; i++) {
      result.push(i);
    }
    return result;
  });

  protected readonly navClass = NAV_CLASS;

  protected pageClass(active: boolean): string {
    return [
      'flex size-9 items-center justify-center rounded-md',
      active
        ? 'bg-primary-100 text-primary-800 dark:bg-primary/24 dark:text-text'
        : 'text-muted hover:bg-content-hover hover:text-text'
    ].join(' ');
  }

  protected toPage(page: number): void {
    const clamped = Math.max(0, Math.min(page, this.pageCount() - 1));
    if (clamped === this.currentPage()) {
      return;
    }
    const rows = this.rows();
    this.onPageChange.emit({
      page: clamped,
      first: clamped * rows,
      rows,
      pageCount: this.pageCount()
    });
  }
}
