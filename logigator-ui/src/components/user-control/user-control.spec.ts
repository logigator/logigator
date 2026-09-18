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
  readonly toggled = vi.fn();
  readonly rows = signal<MenuItem[]>([
    { label: 'Account', icon: 'ph ph-user', command: () => this.account() },
    { label: 'Hidden', visible: false }
  ]);
}

function panel(): Element | null {
  return document.querySelector('.cdk-overlay-container lg-user-panel');
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
});
