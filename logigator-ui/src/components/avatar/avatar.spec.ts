import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgAvatar } from './avatar';
import type { LgImageSource } from '../../tokens/image-source';

/** An avatar ladder as a server that encodes two formats answers it. */
const LADDER: LgImageSource[] = [
  { url: '/a/64.webp', width: 64, format: 'webp' },
  { url: '/a/64.jpg', width: 64, format: 'jpeg' },
  { url: '/a/256.webp', width: 256, format: 'webp' },
  { url: '/a/256.jpg', width: 256, format: 'jpeg' }
];

function render(inputs: Record<string, unknown>) {
  const f = TestBed.createComponent(LgAvatar);
  for (const [name, value] of Object.entries(inputs)) {
    f.componentRef.setInput(name, value);
  }
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

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

  it('offers every width of every encoding, the first format first', () => {
    const el = render({ image: LADDER });

    // One <source> per encoding, in the order the caller listed them.
    const sources = [...el.querySelectorAll('source')];
    expect(sources.map((s) => s.getAttribute('type'))).toEqual(['image/webp']);
    expect(sources[0].getAttribute('srcset')).toBe(
      '/a/64.webp 64w, /a/256.webp 256w'
    );

    // The last encoding lands on the <img>: that is what a browser matching no
    // <source> falls back to.
    const img = el.querySelector('img')!;
    expect(img.getAttribute('srcset')).toBe('/a/64.jpg 64w, /a/256.jpg 256w');
  });

  it('states the box it draws in, so the pixel ratio picks the width', () => {
    // A width descriptor means nothing without the CSS size beside it: the
    // browser multiplies this by the device pixel ratio to choose a rung.
    expect(
      render({ image: LADDER }).querySelector('img')!.getAttribute('sizes')
    ).toBe('32px');
    expect(
      render({ image: LADDER, size: 'xlarge' })
        .querySelector('img')!
        .getAttribute('sizes')
    ).toBe('64px');
  });

  it('degrades a single URL to a bare src', () => {
    const img = render({ image: '/me.png' }).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/me.png');
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
  });

  it('falls back to the label when the ladder is empty', () => {
    const el = render({ image: [], label: 'A' });
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('A');
  });
});
