import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgIconField } from './icon-field';
import { LgInputIcon } from './input-icon';

@Component({
  imports: [LgIconField, LgInputIcon],
  template: `
    <lg-icon-field [iconPosition]="position()">
      <lg-input-icon class="ph ph-magnifying-glass" />
      <input lg-test-input class="real-input" />
    </lg-icon-field>
  `
})
class HostComponent {
  readonly position = signal<'left' | 'right'>('left');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return f;
}

describe('LgIconField', () => {
  it('reflects iconPosition to a host attribute (default left)', () => {
    const f = setup();
    const field = f.nativeElement.querySelector('lg-icon-field') as HTMLElement;
    expect(field.getAttribute('data-icon-position')).toBe('left');

    f.componentInstance.position.set('right');
    f.detectChanges();
    expect(field.getAttribute('data-icon-position')).toBe('right');
  });

  it('marks the icon decorative and colours it from the surface scale', () => {
    const f = setup();
    const icon = f.nativeElement.querySelector('lg-input-icon') as HTMLElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.className).toContain('text-surface-400');
    // The consumer's glyph class merges onto the host.
    expect(icon.className).toContain('ph-magnifying-glass');
  });
});
