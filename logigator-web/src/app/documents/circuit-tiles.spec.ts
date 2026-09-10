import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from '../theming/theming.service';
import { CircuitTiles } from './circuit-tiles';
import type { CircuitTileEntry } from './circuit-tile-entry';

const ENTRY: CircuitTileEntry = {
  id: 'a',
  name: '8-Bit ALU',
  href: '/en/community/projects/abc',
  external: false,
  preview: {
    light: [{ url: '/p/light.webp', width: 320, height: 240, format: 'webp' }],
    dark: [{ url: '/p/dark.webp', width: 320, height: 240, format: 'webp' }]
  },
  meta: {
    author: {
      id: '33333333-3333-4333-8333-333333333333',
      username: 'marek_h',
      avatar: null
    },
    authorHref: '/en/community/users/33333333-3333-4333-8333-333333333333',
    stars: 12
  }
};

function render(entries: CircuitTileEntry[]): HTMLElement {
  const fixture = TestBed.createComponent(CircuitTiles);
  fixture.componentRef.setInput('entries', entries);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('CircuitTiles', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
  });

  it('draws only the preview for the scheme the page is in', () => {
    // Both themes are separate renders and no <picture> can negotiate a colour
    // scheme, so a CSS-hidden second image would be downloaded for nothing.
    TestBed.inject(ThemingService).setTheme('dark');
    expect(render([ENTRY]).innerHTML).toContain('/p/dark.webp');
    expect(render([ENTRY]).innerHTML).not.toContain('/p/light.webp');

    TestBed.inject(ThemingService).setTheme('light');
    expect(render([ENTRY]).innerHTML).toContain('/p/light.webp');
    expect(render([ENTRY]).innerHTML).not.toContain('/p/dark.webp');
  });

  it('gives a destination off the site a real href and a new tab', () => {
    // The editor is another deployment on this origin: routerLink would ask
    // the site's own router for a route it does not have.
    const anchor = render([
      { ...ENTRY, external: true, href: '/editor/share/abc' }
    ]).querySelector('a[lgCircuitTileLink]')!;

    expect(anchor.getAttribute('href')).toBe('/editor/share/abc');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toContain('noopener');
  });

  it('keeps a destination inside the site a router navigation', () => {
    const anchor = render([ENTRY]).querySelector('a[lgCircuitTileLink]')!;
    expect(anchor.getAttribute('target')).toBeNull();
    expect(anchor.getAttribute('href')).toBe('/en/community/projects/abc');
  });

  it('links the author to their own page, outside the tile link', () => {
    const author = render([ENTRY]).querySelector('a[lgCircuitTileAuthor]')!;
    expect(author.getAttribute('href')).toBe(
      '/en/community/users/33333333-3333-4333-8333-333333333333'
    );
    expect(author.closest('a[lgCircuitTileLink]')).toBeNull();
  });
});
