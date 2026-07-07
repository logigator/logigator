import { Component } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgBadge } from './badge';

@Component({
  imports: [LgBadge],
  template: `<lg-badge [severity]="severity" [rounded]="rounded">{{
    content
  }}</lg-badge>`
})
class HostComponent {
  severity: 'secondary' | undefined = undefined;
  rounded = false;
  content: string | number = '';
}

describe('LgBadge', () => {
  it('renders the projected content with the secondary fill', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.content = 7;
    f.componentInstance.severity = 'secondary';
    f.detectChanges();
    const span = f.nativeElement.querySelector('span') as HTMLElement;
    expect(span.textContent).toContain('7');
    expect(span.className).toContain('bg-surface-100');
  });

  it('is a full pill when rounded', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.content = 1;
    f.componentInstance.rounded = true;
    f.detectChanges();
    expect(
      (f.nativeElement.querySelector('span') as HTMLElement).className
    ).toContain('rounded-full');
  });
});
