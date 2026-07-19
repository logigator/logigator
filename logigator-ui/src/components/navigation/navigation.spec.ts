import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgNavigation } from './navigation';
import { NavigationItem } from './navigation-item.model';

const ITEMS: readonly NavigationItem[] = [
  { id: 'intro', label: 'Introduction' },
  {
    id: 'basics',
    label: 'Basics',
    items: [
      { id: 'tools', label: 'Tools' },
      { id: 'wires', label: 'Wires' }
    ]
  }
];

@Component({
  imports: [LgNavigation],
  template: `<lg-navigation
    [items]="items"
    [selected]="selected()"
    (selectedChange)="selected.set($event)"
  />`
})
class HostComponent {
  readonly items = ITEMS;
  readonly selected = signal<string | undefined>(undefined);
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const buttons = () =>
    Array.from(
      f.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
  const byLabel = (label: string) =>
    buttons().find((b) => b.textContent?.includes(label))!;
  return { f, byLabel };
}

describe('LgNavigation', () => {
  it('selects a leaf on activation (model updates, aria-current set)', () => {
    const { f, byLabel } = setup();
    byLabel('Tools').click();
    f.detectChanges();
    expect(f.componentInstance.selected()).toBe('tools');
    expect(byLabel('Tools').getAttribute('aria-current')).toBe('page');
    expect(byLabel('Wires').getAttribute('aria-current')).toBeNull();
  });

  it('reflects an outside selection change', () => {
    const { f, byLabel } = setup();
    f.componentInstance.selected.set('intro');
    f.detectChanges();
    expect(byLabel('Introduction').getAttribute('aria-current')).toBe('page');
  });

  it('starts groups expanded and collapses them on header toggle', () => {
    const { f, byLabel } = setup();
    expect(byLabel('Basics').getAttribute('aria-expanded')).toBe('true');
    byLabel('Basics').click();
    f.detectChanges();
    expect(byLabel('Basics').getAttribute('aria-expanded')).toBe('false');
  });

  it('re-expands a collapsed group when one of its leaves gets selected', () => {
    const { f, byLabel } = setup();
    byLabel('Basics').click();
    f.detectChanges();
    expect(byLabel('Basics').getAttribute('aria-expanded')).toBe('false');

    f.componentInstance.selected.set('wires');
    f.detectChanges();
    expect(byLabel('Basics').getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves a collapsed group collapsed while the selection is elsewhere', () => {
    const { f, byLabel } = setup();
    byLabel('Basics').click();
    f.componentInstance.selected.set('intro');
    f.detectChanges();
    expect(byLabel('Basics').getAttribute('aria-expanded')).toBe('false');
  });
});
