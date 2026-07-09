import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgTextarea } from './textarea';

@Component({
  imports: [LgTextarea, FormsModule],
  template: `<textarea
    lgTextarea
    class="w-full"
    rows="12"
    [invalid]="invalid()"
    [(ngModel)]="value"
  ></textarea>`
})
class HostComponent {
  readonly invalid = signal(false);
  value = 'draft';
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const ta = f.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
  return { f, ta };
}

describe('LgTextarea', () => {
  it('applies the field skin and keeps consumer classes/attrs', () => {
    const { ta } = setup();
    expect(ta.className).toContain('w-full');
    expect(ta.className).toContain('bg-surface-0');
    expect(ta.rows).toBe(12);
  });

  it('adds the invalid border only when invalid', () => {
    const { f, ta } = setup();
    expect(ta.className).not.toContain('border-error');
    f.componentInstance.invalid.set(true);
    f.detectChanges();
    expect(ta.className).toContain('border-error');
  });
});
