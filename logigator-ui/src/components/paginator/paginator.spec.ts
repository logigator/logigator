import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgPaginator, LgPaginatorState } from './paginator';

function setup(first: number, rows: number, total: number) {
  const f = TestBed.createComponent(LgPaginator);
  f.componentRef.setInput('first', first);
  f.componentRef.setInput('rows', rows);
  f.componentRef.setInput('totalRecords', total);
  f.detectChanges();
  const buttons = Array.from(
    f.nativeElement.querySelectorAll('button')
  ) as HTMLButtonElement[];
  const events: LgPaginatorState[] = [];
  f.componentInstance.onPageChange.subscribe((e) => events.push(e));
  return { f, buttons, events };
}

describe('LgPaginator', () => {
  it('renders a numbered link per page and marks the current one', () => {
    const { f } = setup(0, 10, 35); // 4 pages
    const current = f.nativeElement.querySelector(
      '[aria-current=page]'
    ) as HTMLElement;
    expect(current.textContent?.trim()).toBe('1');
    const numbered = Array.from(
      f.nativeElement.querySelectorAll('button')
    ).filter((b) => /^\d+$/.test((b as HTMLElement).textContent?.trim() ?? ''));
    expect(numbered).toHaveLength(4);
  });

  it('disables first/prev on the first page', () => {
    const { buttons } = setup(0, 10, 35);
    expect(buttons[0].disabled).toBe(true); // first
    expect(buttons[1].disabled).toBe(true); // prev
  });

  it('emits the next page with computed first/pageCount', () => {
    const { buttons, events } = setup(0, 10, 35);
    // [first, prev, 1,2,3,4, next, last] → next is index 6
    buttons[6].click();
    expect(events.at(-1)).toEqual({
      page: 1,
      first: 10,
      rows: 10,
      pageCount: 4
    });
  });

  it('jumps to the last page', () => {
    const { buttons, events } = setup(0, 10, 35);
    buttons.at(-1)!.click();
    expect(events.at(-1)?.page).toBe(3);
  });

  it('does not emit when clicking the current page', () => {
    const { f, events } = setup(0, 10, 35);
    const current = f.nativeElement.querySelector(
      '[aria-current=page]'
    ) as HTMLButtonElement;
    current.click();
    expect(events).toHaveLength(0);
  });
});
