import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import { communityRow, publicProfile } from '../../testing/community-rows';
import { configureTestBed } from '../../testing/configure-test-bed';
import { clearSeoHead, jsonLdGraph, jsonLdNode } from '../../testing/json-ld';
import { TranslationService } from '../translation/translation.service';
import { homeJsonLd } from '../pages/home/home-json-ld';
import { communityDocumentJsonLd } from '../pages/community/community-document-json-ld';
import { CommunityDocumentService } from '../pages/community/community-document.service';
import { profileJsonLd } from '../pages/community/profile-json-ld';
import { ProfileService } from '../pages/community/profile.service';
import { PageMeta, SeoService } from './seo.service';
import { SITE_ORIGIN } from './site-origin';

const ORIGIN = 'https://logigator.com';
const LINK = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';

/**
 * A string that reads as a dotted translation key rather than as prose. The
 * failure this audit is for: a node filled from a key the active language does
 * not have publishes the key itself, which is what a crawler then reads.
 */
const RAW_KEY = /^[a-z][a-zA-Z]*(\.[a-zA-Z]+){1,}$/;

/** Every string in the graph, with the path it sits at, for a legible failure. */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, path ? `${path}.${key}` : key)
    );
  }
  return [];
}

/**
 * The graph every page emits, in all four languages.
 *
 * The nodes read translated strings, and the language a page's head describes
 * comes off the URL rather than off the translation service — so a page that
 * renders in German with an English table loaded, or a key one locale is
 * missing, shows up here and nowhere else.
 */
describe('the JSON-LD graph in every language', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    configureTestBed([{ provide: SITE_ORIGIN, useValue: ORIGIN }]);
    http = TestBed.inject(HttpTestingController);
    clearSeoHead();
  });

  async function inLanguage(
    lang: LanguageId,
    page: PageMeta,
    path: string
  ): Promise<void> {
    await TestBed.inject(TranslationService).setActiveLang(lang);
    TestBed.inject(SeoService).apply(page, path);
  }

  async function resolveDocument(): Promise<void> {
    const resolved = TestBed.inject(CommunityDocumentService).resolve(
      'projects',
      LINK
    );
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush({ ...communityRow('Half adder', LINK), forkedFrom: null });
    await resolved;
  }

  async function resolveProfile(): Promise<void> {
    const resolved = TestBed.inject(ProfileService).resolveProfile(USER);
    http.expectOne(`/api/community/users/${USER}`).flush(publicProfile());
    await resolved;
  }

  const PAGES: Record<
    string,
    {
      seo: PageMeta;
      path: (lang: string) => string;
      resolve?: () => Promise<void>;
      /** The home page draws none: a trail of one item says nothing. */
      trail?: false;
    }
  > = {
    home: {
      seo: { titleKey: 'pages.home.title', jsonLd: homeJsonLd },
      path: (lang) => `/${lang}`,
      trail: false
    },
    'documentation page': {
      seo: {
        titleKey: 'pages.docs.pages.shortcuts',
        ancestors: [{ titleKey: 'pages.docs.title', path: '/docs' }]
      },
      path: (lang) => `/${lang}/docs/shortcuts`
    },
    'published document': {
      seo: {
        titleKey: 'pages.community.browse.projectsTitle',
        jsonLd: communityDocumentJsonLd,
        ancestors: [
          {
            titleKey: 'pages.community.browse.projectsTitle',
            path: '/community/projects'
          }
        ]
      },
      path: (lang) => `/${lang}/community/projects/${LINK}`,
      resolve: resolveDocument
    },
    profile: {
      seo: {
        titleKey: 'pages.community.profile.title',
        jsonLd: profileJsonLd
      },
      path: (lang) => `/${lang}/community/users/${USER}`,
      resolve: resolveProfile
    }
  };

  for (const [name, page] of Object.entries(PAGES)) {
    it.each(AVAILABLE_LANGUAGES.map(({ id }) => id))(
      `fills the ${name}'s nodes with %s prose, not keys`,
      async (lang) => {
        await page.resolve?.();
        await inLanguage(lang, page.seo, page.path(lang));

        const values = strings(jsonLdGraph());
        expect(values.length).toBeGreaterThan(0);
        for (const [path, value] of values) {
          expect(value.trim(), `${path} is empty`).not.toBe('');
          expect(RAW_KEY.test(value), `${path} = ${value}`).toBe(false);
        }
      }
    );

    it.each(AVAILABLE_LANGUAGES.map(({ id }) => id))(
      `names the ${name}'s trail inside its own %s URLs`,
      async (lang) => {
        await page.resolve?.();
        await inLanguage(lang, page.seo, page.path(lang));

        const trail = jsonLdNode('BreadcrumbList');
        if (page.trail === false) {
          expect(trail).toBeUndefined();
          return;
        }
        // Every step is a URL a reader can follow in the language they are
        // reading — a crumb pointing at another language's page is the
        // `hreflang` pairing broken from inside the document.
        const items = (trail?.['itemListElement'] ?? []) as {
          name: string;
          item: string;
        }[];
        expect(items.length).toBeGreaterThan(1);
        for (const step of items) {
          expect(step.name.trim()).not.toBe('');
          expect(step.item, step.name).toMatch(
            new RegExp(`^${ORIGIN}/${lang}(/|$)`)
          );
        }
      }
    );
  }
});
