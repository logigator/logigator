import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgUserControl } from './user-control';
import { MenuItem } from '../menu/menu-item.model';

@Component({
  imports: [LgUserControl],
  template: `
    <lg-user-control
      signedOutLabel="Not signed in"
      [username]="username()"
      [model]="rows()"
    >
      <ng-template #sections>
        <label class="theme">
          Theme
          <input type="checkbox" (change)="toggled()" />
        </label>
      </ng-template>
    </lg-user-control>
  `
})
class HostComponent {
  readonly username = signal<string | undefined>('marek_h');
  readonly account = vi.fn();
  readonly signIn = vi.fn();
  readonly toggled = vi.fn();
  readonly rows = signal<MenuItem[]>([
    { label: 'Account', icon: 'ph ph-user', command: () => this.account() },
    { label: 'Hidden', visible: false },
    { label: 'Sign in', href: '/login', command: () => this.signIn() },
    { label: 'Help', href: '/help', target: '_blank' }
  ]);
}

function panel(): Element | null {
  return document.querySelector('.cdk-overlay-container lg-user-panel');
}

/**
 * Clicks `el` and reports whether the component cancelled the click. A
 * listener after it cancels whatever is left, so an unclaimed click on a link
 * does not navigate the test document.
 */
function clickClaimed(el: HTMLElement, init: MouseEventInit = {}): boolean {
  let claimed = false;
  const record = (event: Event) => {
    claimed = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', record);
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
  );
  document.removeEventListener('click', record);
  return claimed;
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const trigger = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, trigger };
}

describe('LgUserControl', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('labels the trigger with the account, or the signed-out label without one', () => {
    const { f, trigger } = setup();
    expect(trigger.textContent).toContain('marek_h');

    f.componentInstance.username.set(undefined);
    f.detectChanges();
    expect(trigger.textContent).toContain('Not signed in');
  });

  it('renders the projected sections again on every open', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(panel()?.querySelector('.theme')).not.toBeNull();

    trigger.click();
    f.detectChanges();
    trigger.click();
    f.detectChanges();
    expect(panel()?.querySelector('.theme')).not.toBeNull();
  });

  it('runs a row and closes, but stays open for a section', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();

    const section = panel()?.querySelector('.theme input') as HTMLInputElement;
    section.click();
    f.detectChanges();
    expect(f.componentInstance.toggled).toHaveBeenCalled();
    expect(panel()).not.toBeNull();

    const rows = panel()?.querySelectorAll('button') ?? [];
    expect(rows.length).toBe(1);
    (rows[0] as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.componentInstance.account).toHaveBeenCalled();
    expect(panel()).toBeNull();
  });

  it('renders a row with an href as a link, closing on any click but running it only on a plain one', () => {
    const { f, trigger } = setup();
    const link = () => panel()!.querySelector<HTMLAnchorElement>('a')!;

    trigger.click();
    f.detectChanges();
    expect(link().getAttribute('href')).toBe('/login');
    expect(link().hasAttribute('target')).toBe(false);
    expect(
      panel()!.querySelector('a[href="/help"]')?.getAttribute('target')
    ).toBe('_blank');
    expect(clickClaimed(link(), { shiftKey: true })).toBe(false);
    f.detectChanges();
    expect(f.componentInstance.signIn).not.toHaveBeenCalled();
    expect(panel()).toBeNull();

    trigger.click();
    f.detectChanges();
    expect(clickClaimed(link())).toBe(true);
    f.detectChanges();
    expect(f.componentInstance.signIn).toHaveBeenCalledTimes(1);
    expect(panel()).toBeNull();
  });
});
