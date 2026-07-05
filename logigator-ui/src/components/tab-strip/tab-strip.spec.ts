import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgTabStripItem, LgTabStrip } from './tab-strip';

@Component({
  imports: [LgTabStrip],
  template: `<lg-tab-strip
    [tabs]="tabs()"
    (selected)="selected.set($event)"
    (closed)="closed.set($event)"
  ></lg-tab-strip>`
})
class HostComponent {
  readonly selected = signal<string | null>(null);
  readonly closed = signal<string | null>(null);
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
    // Closing must not have selected the tab.
    expect(f.componentInstance.selected()).toBeNull();
  });

  it('shows the dirty dot on a dirty tab', () => {
    const { tabs } = setup();
    expect(tabs[1].querySelector('.tab-dirty')).toBeTruthy();
  });
});
