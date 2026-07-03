import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgAvatar } from './avatar';

describe('LgAvatar', () => {
  it('prefers the image over label/icon', () => {
    const f = TestBed.createComponent(LgAvatar);
    f.componentRef.setInput('image', '/me.png');
    f.componentRef.setInput('label', 'A');
    f.componentRef.setInput('icon', 'ph ph-user');
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).not.toBeNull();
    expect(f.nativeElement.querySelector('i')).toBeNull();
  });

  it('falls back to the label, then the icon', () => {
    const f = TestBed.createComponent(LgAvatar);
    f.componentRef.setInput('label', 'A');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('A');

    const g = TestBed.createComponent(LgAvatar);
    g.componentRef.setInput('icon', 'ph ph-user');
    g.detectChanges();
    expect(g.nativeElement.querySelector('i')?.className).toContain('ph-user');
  });

  it('applies circle shape and xlarge size', () => {
    const f = TestBed.createComponent(LgAvatar);
    f.componentRef.setInput('icon', 'ph ph-user');
    f.componentRef.setInput('shape', 'circle');
    f.componentRef.setInput('size', 'xlarge');
    f.detectChanges();
    const inner = f.nativeElement.querySelector('span') as HTMLElement;
    expect(inner.className).toContain('rounded-full');
    expect(inner.className).toContain('size-16');
  });
});
