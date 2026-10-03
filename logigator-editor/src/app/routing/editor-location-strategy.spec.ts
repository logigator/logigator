import { describe, expect, it } from 'vitest';
import { Location, PlatformLocation } from '@angular/common';
import {
  canonicalizeAddress,
  EditorLocationStrategy
} from './editor-location-strategy';

/** The address bar, reduced to what the strategy reads and writes. */
class FakePlatformLocation {
  public pathname = '/';
  public search = '';
  public hash = '';
  /** Every write, by kind — a rewrite that pushes leaves a back step behind. */
  public readonly writes: ('push' | 'replace')[] = [];

  public constructor(private readonly baseHref: string) {}

  public getBaseHrefFromDOM(): string {
    return this.baseHref;
  }

  public pushState(_state: unknown, _title: string, url: string): void {
    this.writes.push('push');
    this.visit(url);
  }

  public replaceState(_state: unknown, _title: string, url: string): void {
    this.writes.push('replace');
    this.visit(url);
  }

  public onPopState(): () => void {
    return () => undefined;
  }

  public onHashChange(): () => void {
    return () => undefined;
  }

  public visit(url: string): void {
    const { pathname, search, hash } = new URL(url, 'https://logigator.test');
    Object.assign(this, { pathname, search, hash });
  }

  public get url(): string {
    return this.pathname + this.search + this.hash;
  }
}

/** A `Location` over the strategy, as the editor's `RouterService` holds it. */
function locationAt(baseHref: string): {
  location: Location;
  bar: FakePlatformLocation;
} {
  const bar = new FakePlatformLocation(baseHref);
  const strategy = new EditorLocationStrategy(
    bar as unknown as PlatformLocation
  );
  return { location: new Location(strategy), bar };
}

/** The editor, opened at `url` and through its startup rewrite. */
function openedAt(url: string): FakePlatformLocation {
  const { location, bar } = locationAt('/editor/');
  bar.visit(url);
  canonicalizeAddress(location, bar);
  return bar;
}

describe('EditorLocationStrategy', () => {
  it('writes the root as the bare mount path, whichever spelling asks', () => {
    const { location, bar } = locationAt('/editor/');

    location.go('/');
    expect(bar.url).toBe('/editor');

    location.replaceState('');
    expect(bar.url).toBe('/editor');
  });

  it('keeps the query and fragment on the root', () => {
    const { location, bar } = locationAt('/editor/');

    location.go('/', 'lang=de');
    expect(bar.url).toBe('/editor?lang=de');

    expect(location.prepareExternalUrl('/#board')).toBe('/editor#board');
  });

  it('leaves a route under the mount path as the stock strategy writes it', () => {
    const { location, bar } = locationAt('/editor/');

    location.go('/share/projects/abc');
    expect(bar.url).toBe('/editor/share/projects/abc');
  });

  it('reads both spellings of the mount path as the root route', () => {
    const { location, bar } = locationAt('/editor/');

    bar.visit('/editor');
    expect(location.path()).toBe('');

    bar.visit('/editor/');
    expect(location.path()).toBe('');

    bar.visit('/editor/project/abc');
    expect(location.path()).toBe('/project/abc');
  });

  it('still writes `/` for an editor served at the origin root', () => {
    const { location, bar } = locationAt('/');

    location.go('/');
    expect(bar.url).toBe('/');
  });
});

describe('canonicalizeAddress', () => {
  // The case it exists for: a returning visitor whose browser still follows the
  // legacy backend's cached `301` from `/editor` lands here.
  it('rewrites the slashed root in place, adding no history entry', () => {
    const bar = openedAt('/editor/');

    expect(bar.url).toBe('/editor');
    expect(bar.writes).toEqual(['replace']);
  });

  it('keeps the query and fragment it was opened with', () => {
    expect(openedAt('/editor/?lang=de#board').url).toBe(
      '/editor?lang=de#board'
    );
  });

  it('rewrites the shell file named outright', () => {
    expect(openedAt('/editor/index.html').url).toBe('/editor');
  });

  it.each(['/editor', '/editor?lang=de', '/editor/share/projects/abc'])(
    'writes nothing when opened at %s, already the canonical form',
    (url) => {
      const bar = openedAt(url);

      expect(bar.url).toBe(url);
      expect(bar.writes).toEqual([]);
    }
  );
});
