import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgBadge } from './badge';

describe('LgBadge', () => {
  it('renders the count with the secondary fill', () => {
    const f = TestBed.createComponent(LgBadge);
    f.componentRef.setInput('value', 7);
    f.componentRef.setInput('severity', 'secondary');
    f.detectChanges();
    const span = f.nativeElement.querySelector('span') as HTMLElement;
    expect(span.textContent).toContain('7');
    expect(span.className).toContain('bg-surface-100');
  });

  it('is a full pill when rounded', () => {
    const f = TestBed.createComponent(LgBadge);
    f.componentRef.setInput('value', 1);
    f.componentRef.setInput('rounded', true);
    f.detectChanges();
    expect(
      (f.nativeElement.querySelector('span') as HTMLElement).className
    ).toContain('rounded-full');
  });
});
