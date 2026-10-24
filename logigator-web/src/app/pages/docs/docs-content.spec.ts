import { describe, expect, it } from 'vitest';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import {
  DOC_PAGE_IDS,
  DocPageId,
  docImages,
  isDocPageId,
  parseDocsLink
} from '@logigator/docs';
import { loadDocPage } from './doc-content';

/** Every authored page in every language: 12 × 4 documents. */
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
});
