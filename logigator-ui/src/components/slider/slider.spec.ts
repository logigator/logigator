import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgSlider } from './slider';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgSlider, FormsModule],
  template: `<lg-slider
    [min]="0"
    [max]="100"
    [step]="step()"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  ></lg-slider>`
})
class HostComponent {
  readonly step = signal(1);
  readonly value = signal(50);
}

async function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const host = f.nativeElement.querySelector('lg-slider') as HTMLElement;
  const handle = f.nativeElement.querySelector('[role=slider]') as HTMLElement;
  return { f, host, handle };
}

function press(handle: HTMLElement, key: string) {
  handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('LgSlider', () => {
  it('positions the handle by percent of the range', async () => {
    const { handle } = await setup();
    expect(handle.style.left).toBe('50%');
    expect(handle.getAttribute('aria-valuenow')).toBe('50');
  });

  it('steps with arrow keys and writes back', async () => {
    const { f, handle } = await setup();
    press(handle, 'ArrowRight');
    expect(f.componentInstance.value()).toBe(51);
    press(handle, 'ArrowLeft');
    press(handle, 'ArrowLeft');
    expect(f.componentInstance.value()).toBe(49);
  });

  it('honors a custom step', async () => {
    const { f, handle } = await setup();
    f.componentInstance.step.set(10);
    f.detectChanges();
    press(handle, 'ArrowUp');
    expect(f.componentInstance.value()).toBe(60);
  });

  it('jumps to bounds with Home/End', async () => {
    const { f, handle } = await setup();
    press(handle, 'End');
    expect(f.componentInstance.value()).toBe(100);
    press(handle, 'Home');
    expect(f.componentInstance.value()).toBe(0);
  });

  it('maps a pointer position to a value', async () => {
    const { f, host } = await setup();
    host.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    host.setPointerCapture = () => undefined;
    host.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 150, bubbles: true })
    );
    expect(f.componentInstance.value()).toBe(75);
  });
});
