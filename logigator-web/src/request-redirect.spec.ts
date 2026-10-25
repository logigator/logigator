import { describe, expect, it } from 'vitest';
import type { LanguageId } from '@logigator/core';
import {
  NOT_FOUND,
  redirectHeaders,
  requestRedirect,
  type RequestRedirect
} from './request-redirect';

const LINK = '2b6f0cc9-04d9-4d14-8d5a-8e2bb7d2b1a3';

/** The answer for a URL, negotiating `lang` for a request that names none. */
function answer(url: string, lang: LanguageId = 'de') {
  const query = url.indexOf('?');
  const [path, search] =
    query === -1 ? [url, ''] : [url.slice(0, query), url.slice(query)];
  return requestRedirect(path, search, () => lang);
}

describe('requestRedirect', () => {
  it('lets a canonical page, and the files answered at the root, through', () => {
    for (const url of [
      '/en',
      '/de/community/projects?page=2',
      '/fr/docs/wires.md',
      '/es/changelog.atom',
      '/robots.txt',
      '/sitemap.xml',
      '/sitemaps/projects-1.xml'
    ]) {
      expect(answer(url), url).toBeNull();
    }
  });

  it('sends a URL without a language to the negotiated one', () => {
    expect(answer('/community/projects?search=adder', 'fr')).toEqual({
      status: 302,
      location: '/fr/community/projects?search=adder',
      negotiated: true
    });
    expect(answer('/', 'es')).toMatchObject({ location: '/es' });
  });

  it('negotiates the files a language holds like a page', () => {
    expect(answer('/docs/wires.md')).toMatchObject({
      location: '/de/docs/wires.md'
    });
    expect(answer('/changelog.atom')).toMatchObject({
      location: '/de/changelog.atom'
    });
  });

  it('ends any other file without a language in a 404', () => {
    for (const url of [
      '/favicon.ico',
      '/browserconfig.xml',
      '/wp-login.php?x=1',
      '/.env',
      '/sitemaps/notes.txt'
    ]) {
      expect(answer(url), url).toBe(NOT_FOUND);
    }
  });

  it('fixes a non-canonical path permanently, the query kept', () => {
    expect(answer('/en//login/?returnUrl=%2Fen')).toEqual({
      status: 301,
      location: '/en/login?returnUrl=%2Fen',
      negotiated: false
    });
    expect(answer('/robots.txt/')).toMatchObject({ location: '/robots.txt' });
  });

  it('negotiates a non-canonical path without a language in the same hop', () => {
    expect(answer('/community//projects/')).toEqual({
      status: 302,
      location: '/de/community/projects',
      negotiated: true
    });
  });

  it('sends a legacy URL to its successor in one hop', () => {
    // Trailing slash, legacy path and missing language: one redirect.
    expect(answer(`/community/project/${LINK}/`)).toEqual({
      status: 301,
      location: `/de/community/projects/${LINK}`,
      negotiated: true
    });
    expect(answer(`/fr/community/project/${LINK}?utm_source=mail`)).toEqual({
      status: 301,
      location: `/fr/community/projects/${LINK}?utm_source=mail`,
      negotiated: false
    });
  });

  it('keeps a pending page temporary', () => {
    expect(answer('/features')).toEqual({
      status: 302,
      location: '/de',
      negotiated: true
    });
    expect(answer('/en/download/')).toEqual({
      status: 302,
      location: '/en',
      negotiated: false
    });
  });

  it('reads a legacy page count on an unprefixed listing', () => {
    expect(answer('/community/projects?page=2&orderBy=latest')).toEqual({
      status: 301,
      location: '/de/community/projects?page=3&orderBy=latest',
      negotiated: true
    });
  });

  it('asks for the visitor language only when the target needs one', () => {
    const refuse = (): LanguageId => {
      throw new Error('negotiated');
    };
    expect(requestRedirect('/en//examples', '', refuse)).toMatchObject({
      location: '/en/examples'
    });
    expect(requestRedirect('/favicon.ico', '', refuse)).toBe(NOT_FOUND);
  });
});

describe('redirectHeaders', () => {
  const redirect = (
    status: 301 | 302,
    negotiated: boolean
  ): RequestRedirect => ({ status, location: '/en', negotiated });

  it('keeps a negotiated redirect out of every cache, permanent or not', () => {
    for (const status of [301, 302] as const) {
      expect(redirectHeaders(redirect(status, true))).toEqual({
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie, Accept-Language'
      });
    }
  });

  it('bounds how long a permanent redirect is held', () => {
    expect(redirectHeaders(redirect(301, false))['Cache-Control']).toMatch(
      /^public, max-age=\d+$/
    );
  });

  it('holds no temporary redirect', () => {
    expect(redirectHeaders(redirect(302, false))['Cache-Control']).toBe(
      'no-store'
    );
  });
});
