import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgToggleSwitch } from './toggle-switch';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgToggleSwitch, FormsModule],
  template: `<lg-toggle-switch
    inputId="t"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  ></lg-toggle-switch>`
})
class HostComponent {
  readonly value = signal(false);
}

async function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const checkbox = f.nativeElement.querySelector(
    'input[type=checkbox]'
  ) as HTMLInputElement;
  return { f, checkbox };
}

describe('LgToggleSwitch', () => {
  it('reflects the model into the checkbox', async () => {
    const { f, checkbox } = await setup();
    expect(checkbox.checked).toBe(false);
    f.componentInstance.value.set(true);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(checkbox.checked).toBe(true);
  });

  it('writes the toggled value back through ngModel', async () => {
    const { f, checkbox } = await setup();
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(f.componentInstance.value()).toBe(true);
  });

  it('exposes a role=switch control wired to inputId', async () => {
    const { checkbox } = await setup();
    expect(checkbox.getAttribute('role')).toBe('switch');
    expect(checkbox.id).toBe('t');
  });
});
