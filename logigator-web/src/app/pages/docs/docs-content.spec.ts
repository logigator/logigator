import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import {
  DOC_PAGE_IDS,
  DocPageId,
  docImages,
  isDocPageId,
  parseDocsLink
} from '@logigator/docs';
import { headingSlug } from '@logigator/ui';
import { loadDocPage } from './doc-content';

/** Every authored page in every language: 11 × 4 documents. */
const DOCUMENTS: { page: DocPageId; lang: LanguageId }[] = DOC_PAGE_IDS.flatMap(
  (page) => AVAILABLE_LANGUAGES.map(({ id }) => ({ page, lang: id }))
);

/** Every `](destination)` a document authors, in source order. */
function destinations(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)\s]+)/g)].map((match) => match[1]);
}

describe('the documentation content', () => {
  it.each(DOCUMENTS)(
    'links only to pages that exist in $page/$lang',
    async ({ page, lang }) => {
      const targets = destinations(await loadDocPage(page, lang))
        .map(parseDocsLink)
        .filter((target) => target !== null);

      expect(targets.filter((target) => !isDocPageId(target.page))).toEqual([]);
    }
  );

  /**
   * A screenshot is addressed by the path the markdown authors and rendered
   * through the registry the capture tool writes. A picture renamed on disk
   * without its destination — or the other way round — is a broken image in
   * one language only, and nothing else looks at the pair.
   */
  it.each(DOCUMENTS)(
    'resolves every picture it shows in $page/$lang',
    async ({ page, lang }) => {
      const images = docImages(lang);
      const shown = destinations(await loadDocPage(page, lang)).filter(
        (destination) => destination.startsWith('./')
      );

      expect(shown.filter((destination) => !(destination in images))).toEqual(
        []
      );
    }
  );

  /**
   * The renderer emits no heading ids: a `#fragment` resolves against the slug
   * of a heading's own text. A heading renamed in a translation, or a cross
   * link naming an anchor another page dropped, is a link to nowhere.
   */
  it.each(DOCUMENTS)(
    'has resolvable anchors in $page/$lang',
    async ({ page, lang }) => {
      const slugsOf = async (id: DocPageId): Promise<string[]> => {
        const body = document.createElement('div');
        body.innerHTML = await marked.parse(await loadDocPage(id, lang));
        return [...body.querySelectorAll('h1, h2, h3, h4')].map((heading) =>
          headingSlug(heading.textContent ?? '')
        );
      };

      const own = await slugsOf(page);
      const markdown = await loadDocPage(page, lang);

      for (const destination of destinations(markdown)) {
        if (destination.startsWith('#')) {
          expect(own).toContain(decodeURIComponent(destination.slice(1)));
          continue;
        }
        const target = parseDocsLink(destination);
        if (target?.anchor && isDocPageId(target.page)) {
          expect(await slugsOf(target.page)).toContain(target.anchor);
        }
      }
    }
  );
});
