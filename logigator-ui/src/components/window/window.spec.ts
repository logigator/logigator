import { describe, expect, it } from 'vitest';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { WindowSize } from './window-config';
import { LgWindowOutlet } from './window-outlet';
import { WindowRef } from './window-ref';
import { WindowService } from './window.service';

@Component({
  selector: 'lg-test-window-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="child">{{ wordSize() }}</p>
    <button class="self-close" (click)="ref.close('self')">close</button>`
})
class TestWindowChild {
  // `required` so a failure to setInput-before-init throws on first read.
  readonly wordSize = input.required<number>();
  protected readonly ref = inject(WindowRef);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgWindowOutlet],
  template: `<div class="relative"><lg-window-outlet /></div>`
})
class Host {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgWindowOutlet],
  template: `<div class="relative"><lg-window-outlet fullscreen /></div>`
})
class FullscreenHost {}

describe('WindowService + LgWindowOutlet', () => {
  function setup(): {
    fixture: ComponentFixture<Host>;
    service: WindowService;
  } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, service: TestBed.inject(WindowService) };
  }

  function windowsIn(fixture: ComponentFixture<Host>): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('lg-window'));
  }

  function pointer(
    type: string,
    x: number,
    y: number,
    pointerId = 1
  ): PointerEvent {
    return new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId,
      bubbles: true
    });
  }

  it('renders an open window with the child inputs applied', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, {
      title: 'ROM',
      inputValues: { wordSize: 8 }
    });
    fixture.detectChanges();

    const [win] = windowsIn(fixture);
    expect(win).toBeDefined();
    expect(win.querySelector('h2')?.textContent).toContain('ROM');
    expect(win.querySelector('.child')?.textContent).toContain('8');
  });

  it('keeps a signal title live', () => {
    const { fixture, service } = setup();
    const title = signal('first');
    service.open(TestWindowChild, { title, inputValues: { wordSize: 1 } });
    fixture.detectChanges();
    expect(windowsIn(fixture)[0].querySelector('h2')?.textContent).toContain(
      'first'
    );

    title.set('second');
    fixture.detectChanges();
    expect(windowsIn(fixture)[0].querySelector('h2')?.textContent).toContain(
      'second'
    );
  });

  it('emits onChildComponentLoaded and lets the child close itself via WindowRef', async () => {
    const { fixture, service } = setup();
    const ref = service.open(TestWindowChild, { inputValues: { wordSize: 4 } });
    let instance: unknown;
    ref.onChildComponentLoaded.subscribe((i) => (instance = i));
    fixture.detectChanges();
    expect(instance).toBeInstanceOf(TestWindowChild);

    const closed = firstValueFrom(ref.onClose);
    (
      fixture.nativeElement.querySelector('.self-close') as HTMLButtonElement
    ).click();
    expect(await closed).toBe('self');
    fixture.detectChanges();
    expect(windowsIn(fixture)).toHaveLength(0);
  });

  it('closes via the close button and on Escape', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    fixture.detectChanges();
    (
      windowsIn(fixture)[0].querySelector(
        '[aria-label=Close]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(windowsIn(fixture)).toHaveLength(0);

    const ref = service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    fixture.detectChanges();
    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    windowsIn(fixture)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(closed).toBe(true);
  });

  it('hides the close button and ignores Escape when closable is false', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, {
      closable: false,
      inputValues: { wordSize: 1 }
    });
    fixture.detectChanges();
    const [win] = windowsIn(fixture);
    expect(win.querySelector('[aria-label=Close]')).toBeNull();
    win.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();
    expect(windowsIn(fixture)).toHaveLength(1);
  });

  it('cascades initial positions and raises a pressed window above the rest', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    service.open(TestWindowChild, { inputValues: { wordSize: 2 } });
    fixture.detectChanges();

    const [first, second] = windowsIn(fixture);
    expect(first.style.left).toBe('16px');
    expect(second.style.left).toBe('44px');
    expect(Number(second.style.zIndex)).toBeGreaterThan(
      Number(first.style.zIndex)
    );

    first.dispatchEvent(pointer('pointerdown', 0, 0));
    fixture.detectChanges();
    expect(Number(first.style.zIndex)).toBeGreaterThan(
      Number(second.style.zIndex)
    );
  });

  it('moves the window when the title bar is dragged', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    fixture.detectChanges();

    const [win] = windowsIn(fixture);
    const titleBar = win.querySelector('.cursor-move') as HTMLElement;
    titleBar.dispatchEvent(pointer('pointerdown', 100, 100));
    win.dispatchEvent(pointer('pointermove', 140, 130));
    win.dispatchEvent(pointer('pointerup', 140, 130));
    fixture.detectChanges();

    expect(win.style.left).toBe('56px');
    expect(win.style.top).toBe('46px');
  });

  it('resizes from the south-east corner, reporting the size on the ref', () => {
    const { fixture, service } = setup();
    const ref = service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    fixture.detectChanges();
    const sizes: WindowSize[] = [];
    ref.resized.subscribe((size) => sizes.push(size));

    const [win] = windowsIn(fixture);
    const handle = win.querySelector(
      '.cursor-nwse-resize.right-0'
    ) as HTMLElement;
    handle.dispatchEvent(pointer('pointerdown', 456, 376));
    win.dispatchEvent(pointer('pointermove', 556, 426));
    win.dispatchEvent(pointer('pointerup', 556, 426));
    fixture.detectChanges();

    expect(win.style.width).toBe('540px');
    expect(win.style.height).toBe('410px');
    expect(sizes.at(-1)).toEqual({ width: 540, height: 410 });
  });

  it('clamps a resize to the minimum size', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    fixture.detectChanges();

    const [win] = windowsIn(fixture);
    const handle = win.querySelector(
      '.cursor-nwse-resize.right-0'
    ) as HTMLElement;
    handle.dispatchEvent(pointer('pointerdown', 456, 376));
    win.dispatchEvent(pointer('pointermove', 56, -24));
    win.dispatchEvent(pointer('pointerup', 56, -24));
    fixture.detectChanges();

    expect(win.style.width).toBe('240px');
    expect(win.style.height).toBe('160px');
  });

  it('renders takeovers in a fullscreen outlet: no rect, no resize, back closes', () => {
    const fixture = TestBed.createComponent(FullscreenHost);
    fixture.detectChanges();
    const service = TestBed.inject(WindowService);
    const ref = service.open(TestWindowChild, {
      title: 'Nest',
      inputValues: { wordSize: 1 }
    });
    fixture.detectChanges();

    const win = fixture.nativeElement.querySelector('lg-window') as HTMLElement;
    // Fills the outlet instead of floating: no inline rect, no resize zones,
    // no drag cursor, no ✕.
    expect(win.style.left).toBe('');
    expect(win.style.width).toBe('');
    expect(win.classList.contains('inset-0')).toBe(true);
    expect(win.querySelector('.cursor-nwse-resize')).toBeNull();
    expect(win.querySelector('.cursor-move')).toBeNull();
    expect(win.querySelector('[aria-label=Close]')).toBeNull();

    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    (win.querySelector('[aria-label=Back]') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });

  it('closeAll closes every window', () => {
    const { fixture, service } = setup();
    service.open(TestWindowChild, { inputValues: { wordSize: 1 } });
    service.open(TestWindowChild, { inputValues: { wordSize: 2 } });
    fixture.detectChanges();
    expect(windowsIn(fixture)).toHaveLength(2);

    service.closeAll();
    fixture.detectChanges();
    expect(windowsIn(fixture)).toHaveLength(0);
  });
});
