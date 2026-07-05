import { describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { By } from '@angular/platform-browser';
import { LgScroller } from './scroller';

@Component({
  imports: [LgScroller],
  template: `<lg-scroller
    [items]="items()"
    [itemSize]="24"
    scrollHeight="200px"
    styleClass="font-mono"
  >
    <ng-template #item let-row>row:{{ row }}</ng-template>
  </lg-scroller>`
})
class HostComponent {
  readonly items = signal([0, 1, 2, 3]);
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return f;
}

describe('LgScroller', () => {
  it('renders a virtual-scroll viewport with the passthrough class', () => {
    const f = setup();
    const viewport = f.nativeElement.querySelector(
      'cdk-virtual-scroll-viewport'
    ) as HTMLElement;
    expect(viewport).toBeTruthy();
    expect(viewport.className).toContain('font-mono');
    expect(viewport.style.height).toBe('200px');
  });

  it('delegates scrollToIndex to the cdk viewport', () => {
    const f = setup();
    const viewport = f.debugElement.query(
      By.directive(CdkVirtualScrollViewport)
    ).componentInstance as CdkVirtualScrollViewport;
    const spy = vi.spyOn(viewport, 'scrollToIndex');
    const scroller = f.debugElement.query(By.directive(LgScroller))
      .componentInstance as LgScroller;
    scroller.scrollToIndex(2, 'smooth');
    expect(spy).toHaveBeenCalledWith(2, 'smooth');
  });
});
