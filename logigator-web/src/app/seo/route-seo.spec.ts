import { describe, expect, it } from 'vitest';
import { Route } from '@angular/router';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import de from '../../i18n/de';
import en from '../../i18n/en';
import es from '../../i18n/es';
import fr from '../../i18n/fr';
import { routes } from '../app.routes';
import { STATIC_PAGES } from '../../sitemap';
import { PageMeta } from './seo.service';

const TABLES: Record<LanguageId, unknown> = { en, de, es, fr };

/** A dotted key in one locale table, or `undefined` where it names nothing. */
function message(table: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      table
    );
}

/**
 * Every route that renders a page, with the path it renders at.
 *
 * A route with children is a layout rather than a page — `SeoTitleStrategy`
 * reads the deepest activated route, so the head a visitor gets is always a
 * leaf's. The member page is the one that has both, and its four tabs each
 * declare their own.
 */
function pages(
  tree: readonly Route[],
  prefix = ''
): { path: string; seo: PageMeta | undefined }[] {
  return tree.flatMap((route) => {
    const path = [prefix, route.path].filter(Boolean).join('/');
    const seo = (route.data as { seo?: PageMeta } | undefined)?.seo;
    const children = route.children ?? [];
    return [
      ...(route.component && children.length === 0
        ? [{ path: `/${path}`, seo }]
        : []),
      ...pages(children, path)
    ];
  });
}

describe('every page route', () => {
  const rendered = pages(routes);

  it('is found by the walk this suite audits', () => {
    // A guard on the audit itself: a tree this failed to descend would let
    // every assertion below pass over an empty list.
    expect(rendered.length).toBeGreaterThan(20);
    expect(rendered.map((page) => page.path)).toContain('/:lang/examples');
  });

  it('declares a head of its own', () => {
    // Without one the page inherits whatever the last navigation left in the
    // document, which on a server render is the site's own defaults and on a
    // client-side one is the previous page's title.
    for (const page of rendered) {
      expect(page.seo?.titleKey, page.path).toBeTruthy();
    }
  });

  it.each(AVAILABLE_LANGUAGES.map(({ id }) => id))(
    'names title and description keys that %s fills',
    (lang) => {
      for (const { path, seo } of rendered) {
        for (const key of [seo?.titleKey, seo?.descriptionKey]) {
          if (!key) continue;
          const text = message(TABLES[lang], key);
          expect(typeof text, `${path} → ${key}`).toBe('string');
          expect((text as string).trim(), `${path} → ${key}`).not.toBe('');
        }
      }
    }
  );

  it('names keys its ancestors fill too', () => {
    // A trail step's name is a key like any other, and a missing one would put
    // the raw key into the breadcrumb a crawler reads.
    for (const { path, seo } of rendered) {
      for (const ancestor of seo?.ancestors ?? []) {
        for (const { id } of AVAILABLE_LANGUAGES) {
          expect(
            typeof message(TABLES[id], ancestor.titleKey),
            `${path} → ${ancestor.titleKey} (${id})`
          ).toBe('string');
        }
      }
    }
  });

  it('keeps a page out of the index only where its URL is an action', () => {
    const noindex = rendered
      .filter((page) => page.seo?.noindex)
      .map((page) => page.path);

    expect(new Set(noindex)).toEqual(
      new Set(['/:lang/reset-password', '/:lang/verify-email/:token'])
    );
  });

  it('names no trail on a page that cannot be one', () => {
    // The 404 is not a step towards anything, a token page would publish its
    // token, and nothing under `my/` is reachable without a session.
    const noBreadcrumb = rendered
      .filter((page) => page.seo?.breadcrumb === false)
      .map((page) => page.path);

    expect(new Set(noBreadcrumb)).toEqual(
      new Set([
        '/:lang/my/projects',
        '/:lang/my/components',
        '/:lang/my/account',
        '/:lang/verify-email/:token',
        '/:lang/**'
      ])
    );
  });

  it('is in the sitemap when a crawler can reach it', () => {
    // The list of static pages is hand-written, because a priority is editorial
    // and the route tree cannot carry one. This is what keeps it honest: a page
    // added to the router and forgotten there would otherwise just never be
    // crawled, with nothing to say so.
    const listed = new Set(STATIC_PAGES.map((page) => page.path));
    const missing = rendered
      // Unprefixed, which is how the sitemap names a page — it emits one entry
      // per language from one path — so the prefix comes off before anything
      // else is read out of the rest of it.
      .map(({ path, seo }) => ({
        path: path.replace('/:lang', '') || '/',
        seo
      }))
      .filter(
        ({ path, seo }) =>
          // A parameter is a page per row rather than a page: the community
          // half of the file is read from the API instead. `my/` needs a
          // session, the catch-all is the 404, and `noindex` is the page
          // saying of itself that it does not belong in an index — stated
          // there once rather than again here.
          !path.includes(':') &&
          !path.startsWith('/my/') &&
          !path.includes('*') &&
          !seo?.noindex &&
          !listed.has(path)
      )
      .map(({ path }) => path);

    expect(missing).toEqual([]);
  });
});
