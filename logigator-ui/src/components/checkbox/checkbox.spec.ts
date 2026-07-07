import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgCheckbox } from './checkbox';

@Component({
  imports: [LgCheckbox, FormsModule],
  template: `<lg-checkbox
    inputId="c"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  ></lg-checkbox>`
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

describe('LgCheckbox', () => {
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

  it('wires the native control to inputId for external labels', async () => {
    const { checkbox } = await setup();
    expect(checkbox.id).toBe('c');
  });
});
