import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgDivider } from './divider';

describe('LgDivider', () => {
  it('is a horizontal separator by default', () => {
    const f = TestBed.createComponent(LgDivider);
    f.detectChanges();
    const host: HTMLElement = f.nativeElement;
    expect(host.getAttribute('role')).toBe('separator');
    expect(host.getAttribute('aria-orientation')).toBe('horizontal');
    expect(host.className).toContain('w-full');
  });

  it('draws a vertical rule when layout is vertical', () => {
    const f = TestBed.createComponent(LgDivider);
    f.componentRef.setInput('layout', 'vertical');
    f.detectChanges();
    const host: HTMLElement = f.nativeElement;
    expect(host.getAttribute('aria-orientation')).toBe('vertical');
    expect(host.className).toContain('w-px');
  });
});
