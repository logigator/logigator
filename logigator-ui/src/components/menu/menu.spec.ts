import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgMenu } from './menu';
import { MenuItem } from './menu-item.model';

@Component({
  imports: [LgMenu],
  template: `
    <button (click)="menu.toggle($event)">trigger</button>
    <lg-menu
      #menu
      [model]="items()"
      (onShow)="open.set(true)"
      (onHide)="open.set(false)"
    >
      <ng-template #start><div class="start-block">START</div></ng-template>
      <ng-template #item let-item
        ><span class="row">{{ item.label }}</span></ng-template
      >
    </lg-menu>
  `
})
class HostComponent {
  readonly open = signal(false);
  readonly account = vi.fn();
  readonly items = signal<MenuItem[]>([
    { separator: true },
    { label: 'Account', icon: 'ph ph-user', command: () => this.account() },
    { label: 'Log Out', icon: 'ph ph-sign-out' }
  ]);
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const trigger = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, trigger };
}

describe('LgMenu', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('toggles open and closed, firing onShow/onHide', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);
    expect(container()?.querySelector('[role=menu]')).not.toBeNull();

    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('renders the #start block and the #item slot per non-separator item', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(container()?.querySelector('.start-block')?.textContent).toContain(
      'START'
    );
    const rows = Array.from(container()!.querySelectorAll('.row')).map((r) =>
      r.textContent?.trim()
    );
    expect(rows).toEqual(['Account', 'Log Out']);
    // The separator does not render a menuitem button.
    expect(container()!.querySelectorAll('[role=menuitem]')).toHaveLength(2);
  });

  it('runs the item command and closes on select', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const accountItem = container()!.querySelector(
      '[role=menuitem]'
    ) as HTMLButtonElement;
    accountItem.click();
    f.detectChanges();
    expect(f.componentInstance.account).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.open()).toBe(false);
  });

  it('closes on backdrop (outside) click', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const backdrop = document.querySelector(
      '.cdk-overlay-backdrop'
    ) as HTMLElement;
    backdrop.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('ignores keys a nested control already handled (defaultPrevented)', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const panel = document.querySelector(
      '.cdk-overlay-container [role=menu]'
    ) as HTMLElement;
    // A capturing listener stands in for the nested control consuming the key.
    const consume = (e: Event) => e.preventDefault();
    document.addEventListener('keydown', consume, true);
    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
    );
    document.removeEventListener('keydown', consume, true);
    f.detectChanges();
    // Escape was pre-handled, so the menu must NOT close.
    expect(f.componentInstance.open()).toBe(true);
  });

  it('renders menu rows as type="button" so they cannot submit a form', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    container()!
      .querySelectorAll('[role=menuitem]')
      .forEach((el) => expect(el.getAttribute('type')).toBe('button'));
  });
});
