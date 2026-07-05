import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgToast } from './toast';
import { ToastService } from './toast.service';

@Component({
  imports: [LgToast],
  template: `<lg-toast position="bottom-left" class="absolute! -mb-4" />`
})
class HostComponent {}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return { f, service: TestBed.inject(ToastService) };
}

function toasts(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll('[role=alert]'));
}

function progressBar(toast: HTMLElement): HTMLElement | null {
  return toast.querySelector('.lg-toast-progress');
}

/** Matches the duration of the toast leave animation. */
const LEAVE_MS = 300;

describe('LgToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders an added message with its summary and detail', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'Heads up', detail: 'something' });
    f.detectChanges();
    const rendered = toasts(f.nativeElement);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].textContent).toContain('Heads up');
    expect(rendered[0].textContent).toContain('something');
  });

  it('renders the danger severity on the error palette', () => {
    const { f, service } = setup();
    service.add({ severity: 'danger', summary: 'boom' });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    expect(toast.className).toContain('bg-error-surface');
    expect(toast.className).toContain('text-error');
  });

  it('themes the none and secondary severities', () => {
    const { f, service } = setup();
    service.add({ severity: 'none', summary: 'plain' });
    service.add({ severity: 'secondary', summary: 'muted' });
    f.detectChanges();
    const [none, secondary] = toasts(f.nativeElement);
    expect(none.className).toContain('bg-content');
    expect(none.querySelector('.ph-bell')).not.toBeNull();
    expect(secondary.className).toContain('bg-surface-100');
    expect(secondary.querySelector('.ph-note')).not.toBeNull();
  });

  it('auto-dismisses after its life, playing the leave animation first', () => {
    const { f, service } = setup();
    service.add({ severity: 'warn', summary: 'temp', life: 5000 });
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    // At its life the leave animation starts; the toast is still mounted.
    vi.advanceTimersByTime(1);
    f.detectChanges();
    const leaving = toasts(f.nativeElement);
    expect(leaving).toHaveLength(1);
    expect(leaving[0].className).toContain('-translate-x-6');

    vi.advanceTimersByTime(LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('stacks multiple toasts and dismisses each on its own timer', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'first', life: 1000 });
    service.add({ severity: 'success', summary: 'second', life: 3000 });
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(2);

    // The first hits its life and animates out; once the leave finishes only
    // the second — still counting down — remains.
    vi.advanceTimersByTime(1000 + LEAVE_MS);
    f.detectChanges();
    const remaining = toasts(f.nativeElement);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toContain('second');
  });

  it('renders a progress bar sized to the life for auto-dismissing toasts', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'timed', life: 5000 });
    f.detectChanges();
    const bar = progressBar(toasts(f.nativeElement)[0]);
    expect(bar).not.toBeNull();
    expect(bar!.style.animationDuration).toBe('5000ms');
  });

  it('pauses the countdown while the toast is hovered', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'hovered', life: 5000 });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];

    vi.advanceTimersByTime(2000);
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();

    // The progress bar reports paused so its animation freezes.
    expect(progressBar(toast)!.style.animationPlayState).toBe('paused');

    // Well past the original life — still present because the timer is frozen.
    vi.advanceTimersByTime(10000);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    // Leaving resumes with only the remaining ~3000ms left.
    toast.dispatchEvent(new MouseEvent('mouseleave'));
    f.detectChanges();
    expect(progressBar(toast)!.style.animationPlayState).toBe('running');

    vi.advanceTimersByTime(2999);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    vi.advanceTimersByTime(1 + LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('pauses the countdown while keyboard focus is inside the toast', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'focused', life: 5000 });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];

    toast.dispatchEvent(new FocusEvent('focusin'));
    f.detectChanges();
    vi.advanceTimersByTime(10000);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    toast.dispatchEvent(new FocusEvent('focusout'));
    f.detectChanges();
    vi.advanceTimersByTime(5000 + LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('dismisses the toast when the lg-button is clicked', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'closable', life: 5000 });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    const close = toast.querySelector('button') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Dismiss');

    close.click();
    f.detectChanges();
    // The leave animation plays before the toast leaves the DOM.
    const leaving = toasts(f.nativeElement);
    expect(leaving).toHaveLength(1);
    expect(leaving[0].className).toContain('-translate-x-6');
    // Its progress bar is gone the moment it starts leaving.
    expect(progressBar(leaving[0])).toBeNull();

    vi.advanceTimersByTime(LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('positions the stack at the bottom-left corner', () => {
    const { f } = setup();
    const host = f.nativeElement.querySelector('lg-toast') as HTMLElement;
    expect(host.className).toContain('bottom-0');
    expect(host.className).toContain('left-0');
    // The consumer's override class merges onto the host.
    expect(host.className).toContain('-mb-4');
  });
});
