import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgInputText } from './input-text';

@Component({
  imports: [LgInputText, FormsModule],
  template: `<input
    lgInputText
    class="w-full"
    [size]="size()"
    [invalid]="invalid()"
    [(ngModel)]="value"
  />`
})
class HostComponent {
  readonly size = signal<'sm' | undefined>(undefined);
  readonly invalid = signal(false);
  value = 'hello';
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const input = f.nativeElement.querySelector('input') as HTMLInputElement;
  return { f, input };
}

describe('LgInputText', () => {
  it('merges the field skin with the consumer’s static class', () => {
    const { input } = setup();
    // The foundation other skins ride on: the directive's host [class] binding
    // must not wipe the template-static `class`.
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('bg-surface-0');
    expect(input.className).toContain('border-surface-300');
  });

  it('uses the default (md) padding and switches to sm', () => {
    const { f, input } = setup();
    expect(input.className).toContain('px-3');
    f.componentInstance.size.set('sm');
    f.detectChanges();
    expect(input.className).toContain('px-2.5');
    expect(input.className).not.toContain('px-3');
  });

  it('adds the invalid border only when invalid', () => {
    const { f, input } = setup();
    expect(input.className).not.toContain('border-error');
    f.componentInstance.invalid.set(true);
    f.detectChanges();
    expect(input.className).toContain('border-error');
  });

  it('leaves native value binding (ngModel) to Angular', async () => {
    const { f, input } = setup();
    await f.whenStable();
    expect(input.value).toBe('hello');
  });
});
