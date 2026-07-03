import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgRipple } from './ripple';

@Component({
  imports: [LgRipple],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a lgRipple>click</a>`
})
class HostComponent {}

describe('LgRipple', () => {
  it('makes the host a positioned clipping container', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const anchor = f.nativeElement.querySelector('a') as HTMLElement;
    expect(anchor.className).toContain('relative');
    expect(anchor.className).toContain('overflow-hidden');
  });

  it('injects a ripple span on pointer down', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const anchor = f.nativeElement.querySelector('a') as HTMLElement;
    anchor.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 4, clientY: 4 })
    );
    expect(anchor.querySelector('span')).not.toBeNull();
  });
});
