import { describe, expect, it } from 'vitest';
import {
  languageFromPath,
  pathInLanguage,
  pathnameFromUrl,
  pathWithoutLanguage,
  urlInLanguage
} from './language-url';

describe('languageFromPath', () => {
  it('reads the prefix', () => {
    expect(languageFromPath('/de/features')).toBe('de');
  });

  it('reports none for a first segment that is not a language', () => {
    // Otherwise `/features` would read as a language and the real path would
    // be lost when the prefix is stripped.
    expect(languageFromPath('/features')).toBeNull();
  });
});

describe('pathWithoutLanguage', () => {
  it('keeps a path that carries no prefix', () => {
    expect(pathWithoutLanguage('/features')).toBe('/features');
  });

  it('reduces a bare language to the root', () => {
    expect(pathWithoutLanguage('/de')).toBe('/');
  });
});

describe('pathInLanguage', () => {
  it('replaces an existing prefix rather than nesting one', () => {
    expect(pathInLanguage('fr', '/de/features')).toBe('/fr/features');
  });

  it('prefixes the root without a trailing slash', () => {
    expect(pathInLanguage('es', '/')).toBe('/es');
  });
});

describe('pathnameFromUrl', () => {
  it('drops the query, so the prefix behind one is still found', () => {
    // The canonical and the `hreflang` alternates are built from this path.
    // With the query still attached, `/de?x=1` reads as a first segment that is
    // no language, so the prefix survives and every alternate gains a second.
    expect(pathnameFromUrl('/de?utm_source=nl')).toBe('/de');
    expect(languageFromPath(pathnameFromUrl('/de?utm_source=nl'))).toBe('de');
  });

  it('drops the fragment', () => {
    expect(pathnameFromUrl('/de/features#top')).toBe('/de/features');
  });

  it('answers the root for a URL that is nothing but a query', () => {
    expect(pathnameFromUrl('?ref=x')).toBe('/');
  });
});

describe('urlInLanguage', () => {
  it('carries the query and fragment across the switch', () => {
    // The switch is offered on the page the visitor is reading, so whatever it
    // is showing — a search, a page number, an anchor — has to survive.
    expect(urlInLanguage('en', '/de/community?page=3#top')).toBe(
      '/en/community?page=3#top'
    );
  });

  it('does not mistake a query for a path segment', () => {
    expect(urlInLanguage('de', '/?ref=x')).toBe('/de?ref=x');
  });
});
