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
  return Array.from(host.querySelectorAll('.lg-toast'));
}

function liveRegion(host: HTMLElement, politeness: string): HTMLElement {
  return host.querySelector(`[aria-live=${politeness}]`) as HTMLElement;
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

  describe('announcements', () => {
    it('keeps the live regions mounted while empty', () => {
      const { f } = setup();
      expect(liveRegion(f.nativeElement, 'polite')).toBeTruthy();
      expect(liveRegion(f.nativeElement, 'assertive')).toBeTruthy();
      expect(toasts(f.nativeElement)).toHaveLength(0);
    });

    /** The toast element itself must not also be a region, or it double-reads. */
    it('gives the visible toast no live role of its own', () => {
      const { f, service } = setup();
      service.add({ severity: 'danger', summary: 'boom' });
      f.detectChanges();
      const toast = toasts(f.nativeElement)[0];
      expect(toast.getAttribute('role')).toBeNull();
      expect(toast.getAttribute('aria-live')).toBeNull();
    });

    function announce(severity: 'info' | 'success' | 'warn' | 'danger') {
      const { f, service } = setup();
      service.add({ severity, summary: 'Heads up', detail: 'details here' });
      f.detectChanges();
      // The region is cleared, then filled after a paint, so a repeat message
      // still registers as a change.
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      f.detectChanges();
      return {
        polite: liveRegion(f.nativeElement, 'polite').textContent?.trim(),
        assertive: liveRegion(f.nativeElement, 'assertive').textContent?.trim()
      };
    }

    it('routes info and success politely', () => {
      for (const severity of ['info', 'success'] as const) {
        const { polite, assertive } = announce(severity);
        expect(polite).toBe('Heads up. details here');
        expect(assertive).toBe('');
      }
    });

    it('interrupts only for warn and danger', () => {
      for (const severity of ['warn', 'danger'] as const) {
        const { polite, assertive } = announce(severity);
        expect(assertive).toBe('Heads up. details here');
        expect(polite).toBe('');
      }
    });

    /** A burst inside one frame must not collapse to whichever wrote last. */
    it('announces every message in a same-frame burst', () => {
      const { f, service } = setup();
      service.add({ severity: 'info', summary: 'first' });
      service.add({ severity: 'info', summary: 'second' });
      f.detectChanges();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      f.detectChanges();

      const polite = liveRegion(f.nativeElement, 'polite').textContent ?? '';
      expect(polite).toContain('first');
      expect(polite).toContain('second');
    });

    /** Repeats are distinct changes, so the second one is read too. */
    it('re-announces an identical repeat message', () => {
      const { f, service } = setup();
      service.add({ severity: 'info', summary: 'same' });
      f.detectChanges();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      f.detectChanges();

      service.add({ severity: 'info', summary: 'same' });
      f.detectChanges();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      f.detectChanges();

      const polite = liveRegion(f.nativeElement, 'polite').textContent ?? '';
      expect(polite.trim()).toBe('same. same');
    });

    /** Otherwise the region's text grows for the life of the page. */
    it('empties the regions once the stack does', () => {
      const { f, service } = setup();
      service.add({ severity: 'info', summary: 'transient', life: 1000 });
      f.detectChanges();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      f.detectChanges();
      expect(liveRegion(f.nativeElement, 'polite').textContent).toContain(
        'transient'
      );

      vi.advanceTimersByTime(1000 + LEAVE_MS);
      f.detectChanges();

      expect(toasts(f.nativeElement)).toHaveLength(0);
      expect(liveRegion(f.nativeElement, 'polite').textContent?.trim()).toBe(
        ''
      );
    });
  });

  it('renders the danger severity on the error palette', () => {
    const { f, service } = setup();
    service.add({ severity: 'danger', summary: 'boom' });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    expect(toast.className).toContain('bg-error-surface-strong');
    expect(toast.className).toContain('text-error');
  });

  it('auto-dismisses after its life, playing the leave animation first', () => {
    const { f, service } = setup();
    service.add({ severity: 'warn', summary: 'temp', life: 5000 });
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

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

    // Once the first's leave finishes, only the second remains counting down.
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

  it('dismisses the toast when its close button is clicked', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'closable', life: 5000 });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    const close = toast.querySelector('button') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Dismiss');

    close.click();
    f.detectChanges();
    const leaving = toasts(f.nativeElement);
    expect(leaving).toHaveLength(1);
    expect(leaving[0].className).toContain('-translate-x-6');
    // Its progress bar is gone the moment it starts leaving.
    expect(progressBar(leaving[0])).toBeNull();

    vi.advanceTimersByTime(LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('runs the offered action once and dismisses the toast', () => {
    const handler = vi.fn();
    const { f, service } = setup();
    service.add({
      severity: 'warn',
      summary: 'broken',
      life: 0,
      action: { label: 'Fix it', handler }
    });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    // A `life` of 0 opts out of the countdown, so the offer waits to be read.
    expect(progressBar(toast)).toBeNull();

    const buttons = Array.from(toast.querySelectorAll('button'));
    const action = buttons.find((b) => b.textContent?.includes('Fix it'))!;
    action.click();
    f.detectChanges();
    expect(handler).toHaveBeenCalledTimes(1);

    // A second click on the leaving toast must not re-run the handler.
    action.click();
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LEAVE_MS);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('positions the stack at the bottom-left corner', () => {
    const { f } = setup();
    const host = f.nativeElement.querySelector('lg-toast') as HTMLElement;
    expect(host.className).toContain('bottom-0');
    expect(host.className).toContain('left-0');
    expect(host.className).toContain('-mb-4');
  });
});
