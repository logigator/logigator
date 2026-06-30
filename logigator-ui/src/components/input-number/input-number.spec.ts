import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgInputNumber } from './input-number';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgInputNumber, FormsModule],
  template: `<lg-input-number
    [showButtons]="true"
    [min]="0"
    [max]="10"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  ></lg-input-number>`
})
class HostComponent {
  readonly value = signal(5);
}

async function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const input = f.nativeElement.querySelector('input') as HTMLInputElement;
  const [up, down] = Array.from(
    f.nativeElement.querySelectorAll('button')
  ) as HTMLButtonElement[];
  return { f, input, up, down };
}

describe('LgInputNumber', () => {
  it('shows the model value', async () => {
    const { input } = await setup();
    expect(input.value).toBe('5');
  });

  it('emits a number when the user types', async () => {
    const { f, input } = await setup();
    input.value = '7';
    input.dispatchEvent(new Event('input'));
    expect(f.componentInstance.value()).toBe(7);
  });

  it('steps up and down within bounds', async () => {
    const { f, up, down } = await setup();
    up.click();
    expect(f.componentInstance.value()).toBe(6);
    down.click();
    down.click();
    expect(f.componentInstance.value()).toBe(4);
  });

  it('clamps a stepped value to max', async () => {
    const { f, input, up } = await setup();
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    up.click();
    expect(f.componentInstance.value()).toBe(10);
  });

  it('clamps an out-of-range typed value on blur', async () => {
    const { f, input } = await setup();
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    expect(f.componentInstance.value()).toBe(10);
  });
});
