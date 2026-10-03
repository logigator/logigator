import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgTabReorder, LgTabStripItem, LgTabStrip } from './tab-strip';

@Component({
  imports: [LgTabStrip],
  template: `<lg-tab-strip
    [tabs]="tabs()"
    controls="panel-id"
    [reorderDisabled]="reorderDisabled()"
    (selected)="selected.set($event)"
    (closed)="onClosed($event)"
    (reorder)="onReorder($event)"
  ></lg-tab-strip>`
})
class HostComponent {
  readonly selected = signal<string | null>(null);
  readonly closed = signal<string | null>(null);
  readonly reordered = signal<LgTabReorder | null>(null);
  readonly reorderDisabled = signal(false);
  closeCount = 0;

  readonly tabs = signal<LgTabStripItem<string>[]>([
    {
      data: 'main',
      label: 'Main',
      icon: 'ph ph-house',
      active: true,
      fixed: true
    },
    {
      data: 'a',
      label: 'Comp A',
      icon: 'ph ph-circuitry',
      closable: true,
      dirty: true
    },
    { data: 'b', label: 'Comp B' }
  ]);

  onClosed(data: string): void {
    this.closed.set(data);
    this.closeCount++;
  }

  /**
   * Applies the move, as a real consumer does: the strip owns no tab order, so
   * without this nothing the reorder causes is observable. Indices are in the
   * movable subset, which sits after the fixed tabs.
   */
  onReorder(event: LgTabReorder): void {
    this.reordered.set(event);
    const fixed = this.tabs().filter((t) => t.fixed).length;
    const next = [...this.tabs()];
    const [moved] = next.splice(event.previousIndex + fixed, 1);
    next.splice(event.currentIndex + fixed, 0, moved);
    this.tabs.set(next);
  }
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const tabs = Array.from(
    f.nativeElement.querySelectorAll('[role=tab]')
  ) as HTMLElement[];
  return { f, tabs };
}

describe('LgTabStrip', () => {
  it('renders one [role=tab] per item with the active one selected', () => {
    const { tabs } = setup();
    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the fixed tab out of the reorderable drop list', () => {
    const { f } = setup();
    const dropList = f.nativeElement.querySelector(
      '[cdkdroplist], .cdk-drop-list'
    );
    // The two movable tabs live in the drop list; the fixed one does not.
    const inList = dropList.querySelectorAll('[role=tab]');
    expect(inList.length).toBe(2);
  });

  it('emits the tab data on click (title/aria fall back to label)', () => {
    const { f, tabs } = setup();
    expect(tabs[1].getAttribute('title')).toBe('Comp A');
    expect(tabs[1].getAttribute('aria-label')).toBe('Comp A');
    tabs[1].click();
    f.detectChanges();
    expect(f.componentInstance.selected()).toBe('a');
  });

  it('renders a close button only on closable tabs and closes without selecting', () => {
    const { f, tabs } = setup();
    const close = tabs[1].querySelector('.tab-close') as HTMLButtonElement;
    expect(close).toBeTruthy();
    expect(tabs[2].querySelector('.tab-close')).toBeNull();

    close.click();
    f.detectChanges();
    expect(f.componentInstance.closed()).toBe('a');
    expect(f.componentInstance.selected()).toBeNull();
  });

  it('closes exactly once per Enter on the close button', () => {
    const { f, tabs } = setup();
    const close = tabs[1].querySelector('.tab-close') as HTMLButtonElement;

    // Enter on a native button dispatches a click of its own, so a keydown
    // handler on the button would close the tab twice.
    close.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    close.click();
    f.detectChanges();

    expect(f.componentInstance.closed()).toBe('a');
    expect(f.componentInstance.closeCount).toBe(1);
    // The Enter that bubbled up must not have activated the tab either.
    expect(f.componentInstance.selected()).toBeNull();
  });

  describe('keyboard', () => {
    function key(el: HTMLElement, init: KeyboardEventInit): void {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, ...init })
      );
    }

    it('is a single tab stop, with the active tab holding it', () => {
      const { tabs } = setup();
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
        '-1'
      ]);
    });

    it('points every tab at the controlled region', () => {
      const { tabs } = setup();
      for (const tab of tabs) {
        expect(tab.getAttribute('aria-controls')).toBe('panel-id');
      }
    });

    it('moves focus on ArrowRight without activating (manual activation)', () => {
      const { f, tabs } = setup();
      key(tabs[0], { key: 'ArrowRight' });
      f.detectChanges();

      expect(document.activeElement).toBe(tabs[1]);
      expect(f.componentInstance.selected()).toBeNull();
      expect(tabs[1].getAttribute('tabindex')).toBe('0');
      expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    });

    it('activates the focused tab on Enter and on Space', () => {
      const { f, tabs } = setup();
      key(tabs[1], { key: 'Enter' });
      f.detectChanges();
      expect(f.componentInstance.selected()).toBe('a');

      key(tabs[2], { key: ' ' });
      f.detectChanges();
      expect(f.componentInstance.selected()).toBe('b');
    });

    it('wraps with ArrowLeft and jumps with Home/End', () => {
      const { f, tabs } = setup();
      key(tabs[0], { key: 'ArrowLeft' });
      f.detectChanges();
      expect(document.activeElement).toBe(tabs[2]);

      key(tabs[2], { key: 'Home' });
      f.detectChanges();
      expect(document.activeElement).toBe(tabs[0]);

      key(tabs[0], { key: 'End' });
      f.detectChanges();
      expect(document.activeElement).toBe(tabs[2]);
    });

    it('reorders a movable tab with Ctrl+Arrow, in movable index space', () => {
      const { f, tabs } = setup();
      // tabs[1] is the first movable tab, so index 0 of the reorder set.
      key(tabs[1], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();

      expect(f.componentInstance.reordered()).toEqual({
        previousIndex: 0,
        currentIndex: 1
      });
    });

    it('never moves a fixed tab, nor past the ends', () => {
      const { f, tabs } = setup();
      key(tabs[0], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();
      expect(f.componentInstance.reordered()).toBeNull();

      key(tabs[1], { key: 'ArrowLeft', ctrlKey: true });
      f.detectChanges();
      expect(f.componentInstance.reordered()).toBeNull();

      key(tabs[2], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();
      expect(f.componentInstance.reordered()).toBeNull();
    });

    it('honours reorderDisabled', () => {
      const { f, tabs } = setup();
      f.componentInstance.reorderDisabled.set(true);
      f.detectChanges();

      key(tabs[1], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();

      expect(f.componentInstance.reordered()).toBeNull();
    });

    // Re-rendering moves the tab's DOM node, and detaching a focused node
    // blurs it, so a second Ctrl+Arrow would land on <body> and do nothing.
    it('keeps focus on the tab it moved', async () => {
      const { f, tabs } = setup();
      tabs[1].focus();
      key(tabs[1], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();

      // The restore waits for the reordered strip to paint.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(document.activeElement).toBe(tabs[1]);
    });

    it('announces a keyboard reorder through a live region', () => {
      const { f, tabs } = setup();
      const region = f.nativeElement.querySelector(
        '[aria-live=polite]'
      ) as HTMLElement;
      // The region exists before it has anything to say.
      expect(region).toBeTruthy();
      expect(region.textContent?.trim()).toBe('');

      key(tabs[1], { key: 'ArrowRight', ctrlKey: true });
      f.detectChanges();

      expect(region.textContent).toContain('2');
      expect(region.textContent).toContain('2 of 2');
    });
  });
});
