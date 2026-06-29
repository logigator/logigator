import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgTag } from './tag';

describe('LgTag', () => {
  it('renders the value with the severity tint', () => {
    const f = TestBed.createComponent(LgTag);
    f.componentRef.setInput('value', 'badge');
    f.componentRef.setInput('severity', 'info');
    f.detectChanges();
    const span = f.nativeElement.querySelector('span') as HTMLElement;
    expect(span.textContent).toContain('badge');
    expect(span.className).toContain('bg-info-surface');
  });

  it('uses a pill radius when rounded', () => {
    const f = TestBed.createComponent(LgTag);
    f.componentRef.setInput('value', 'x');
    f.componentRef.setInput('rounded', true);
    f.detectChanges();
    expect(
      (f.nativeElement.querySelector('span') as HTMLElement).className
    ).toContain('rounded-xl');
  });
});
