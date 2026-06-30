import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgToast } from './toast';
import { ToastService } from './toast.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  it("maps the invalid 'danger' severity onto the error palette", () => {
    const { f, service } = setup();
    service.add({ severity: 'danger', summary: 'boom' });
    f.detectChanges();
    const toast = toasts(f.nativeElement)[0];
    expect(toast.className).toContain('bg-error-surface');
    expect(toast.className).toContain('text-error');
    expect(toast.className).not.toContain('danger');
  });

  it('auto-dismisses after its life', () => {
    const { f, service } = setup();
    service.add({ severity: 'warn', summary: 'temp', life: 5000 });
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(1);

    vi.advanceTimersByTime(1);
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(0);
  });

  it('stacks multiple toasts and dismisses each on its own timer', () => {
    const { f, service } = setup();
    service.add({ severity: 'info', summary: 'first', life: 1000 });
    service.add({ severity: 'success', summary: 'second', life: 3000 });
    f.detectChanges();
    expect(toasts(f.nativeElement)).toHaveLength(2);

    vi.advanceTimersByTime(1000);
    f.detectChanges();
    const remaining = toasts(f.nativeElement);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toContain('second');
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
