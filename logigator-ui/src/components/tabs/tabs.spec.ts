import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgTab, LgTabPanel, LgTabs } from './tabs';

@Component({
  imports: [LgTabs, LgTab, LgTabPanel],
  template: `<lg-tabs [value]="active()" (valueChange)="active.set($event)">
    <lg-tab value="a">Tab A</lg-tab>
    <lg-tab value="b">Tab B</lg-tab>
    <lg-tab-panel value="a">Panel A</lg-tab-panel>
    <lg-tab-panel value="b">Panel B</lg-tab-panel>
  </lg-tabs>`
})
class HostComponent {
  readonly active = signal('a');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const tabs = Array.from(
    f.nativeElement.querySelectorAll('[role=tab]')
  ) as HTMLButtonElement[];
  const panels = Array.from(
    f.nativeElement.querySelectorAll('[role=tabpanel]')
  ) as HTMLElement[];
  return { f, tabs, panels };
}

describe('LgTabs', () => {
  it('marks the active tab and shows only its panel', () => {
    const { tabs, panels } = setup();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
  });

  it('switches tab on click (model two-way)', () => {
    const { f, tabs, panels } = setup();
    tabs[1].click();
    f.detectChanges();
    expect(f.componentInstance.active()).toBe('b');
    expect(panels[1].hidden).toBe(false);
    expect(panels[0].hidden).toBe(true);
  });

  function press(tab: HTMLElement, key: string) {
    tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('roves with ArrowRight and wraps', () => {
    const { f, tabs } = setup();
    press(tabs[0], 'ArrowRight');
    f.detectChanges();
    expect(f.componentInstance.active()).toBe('b');
    // wrap back to first
    press(tabs[0], 'ArrowRight');
    f.detectChanges();
    expect(f.componentInstance.active()).toBe('a');
  });

  it('jumps to last/first with End/Home', () => {
    const { f, tabs } = setup();
    press(tabs[0], 'End');
    f.detectChanges();
    expect(f.componentInstance.active()).toBe('b');
    press(tabs[0], 'Home');
    f.detectChanges();
    expect(f.componentInstance.active()).toBe('a');
  });
});
