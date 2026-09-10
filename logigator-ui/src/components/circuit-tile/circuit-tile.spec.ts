import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  LgCircuitTile,
  LgCircuitTileAuthor,
  LgCircuitTileLink
} from './circuit-tile';
import type { LgImageSource } from '../../tokens/image-source';

/** A preview ladder as the API's variant matrix answers it. */
const PREVIEW: LgImageSource[] = [
  { url: '/p/320.webp', width: 320, format: 'webp' },
  { url: '/p/320.png', width: 320, format: 'png' },
  { url: '/p/640.webp', width: 640, format: 'webp' }
];

@Component({
  imports: [LgCircuitTile, LgCircuitTileLink, LgCircuitTileAuthor],
  template: `<lg-circuit-tile
    [name]="name"
    [preview]="preview"
    [stars]="stars"
    [starsLabel]="starsLabel"
  >
    <a lgCircuitTileLink href="/project" [attr.aria-label]="name"></a>
    @if (withAuthor) {
      <a lgCircuitTileAuthor href="/author">marek_h</a>
    }
  </lg-circuit-tile>`
})
class Host {
  name = '8-Bit ALU';
  preview: LgImageSource[] | null = PREVIEW;
  stars: number | undefined = 214;
  starsLabel: string | undefined = 'stars';
  withAuthor = true;
}

function render(patch: Partial<Host> = {}) {
  const f = TestBed.createComponent(Host);
  Object.assign(f.componentInstance, patch);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LgCircuitTile', () => {
  it('offers every encoding but the last as a <source>, the last as the <img>', () => {
    const el = render();
    const sources = [...el.querySelectorAll('source')].map((s) => [
      s.getAttribute('type'),
      s.getAttribute('srcset')
    ]);
    // WebP came first in the ladder, so it is the preferred encoding and PNG —
    // the one that has to work everywhere — is what the <img> falls back to.
    expect(sources).toEqual([
      ['image/webp', '/p/320.webp 320w, /p/640.webp 640w']
    ]);
    const img = el.querySelector('img')!;
    expect(img.getAttribute('srcset')).toBe('/p/320.png 320w');
  });

  it('draws no image element for a circuit without a preview', () => {
    const el = render({ preview: null });
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('picture')).toBeNull();
  });

  it('keeps the author out of the tile link, so both are reachable', () => {
    // An anchor inside an anchor is invalid, and the browser would break the
    // author link out of it — which is why the tile is not itself the anchor.
    const el = render();
    const author = el.querySelector('a[lgCircuitTileAuthor]')!;
    expect(author.closest('a[lgCircuitTileLink]')).toBeNull();
    expect(el.querySelectorAll('a')).toHaveLength(2);
  });

  it('suppresses the whole meta row where the list shares an author', () => {
    const el = render({ withAuthor: false, stars: undefined });
    expect(el.textContent).toContain('8-Bit ALU');
    expect(el.textContent).not.toContain('214');
    expect(el.querySelector('a[lgCircuitTileAuthor]')).toBeNull();
  });

  it('names the star count for a screen reader, spaced off the number', () => {
    const el = render();
    // Angular drops the whitespace-only node between the two elements, so
    // without the interpolated space this is announced as “214stars”.
    const meta = el.querySelector('.tabular-nums')!.parentElement!;
    expect(meta.textContent?.replace(/\s+/g, ' ')).toContain('214 stars');
  });
});
