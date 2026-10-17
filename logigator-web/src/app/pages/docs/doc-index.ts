import { LanguageId } from '@logigator/core';
import {
  buildDocsIndex,
  DOC_PAGE_IDS,
  DocsIndex,
  DocsSearchEntry
} from '@logigator/docs';
import { headingSlug } from '@logigator/ui';
import { loadDocPage } from './doc-content';

/**
 * One index per language, built once and kept.
 *
 * Module state rather than a field on the service, because on the server every
 * request gets its own injector: an index cached in a provider would be rebuilt
 * for each visitor searching. What it holds is derived from the build's own
 * content and from nothing in a request, so one copy serves all of them.
 */
const INDEXES = new Map<LanguageId, Promise<DocsIndex>>();

export function docsIndex(lang: LanguageId): Promise<DocsIndex> {
  let pending = INDEXES.get(lang);
  if (!pending) {
    pending = build(lang);
    INDEXES.set(lang, pending);
  }
  return pending;
}

/**
 * Every page of one language, as text. A chunk that fails to load is left out
 * rather than failing the build: search over ten pages beats none.
 */
async function build(lang: LanguageId): Promise<DocsIndex> {
  const entries = await Promise.all(
    DOC_PAGE_IDS.map(async (page): Promise<DocsSearchEntry | null> => {
      try {
        return { page, markdown: await loadDocPage(page, lang) };
      } catch {
        return null;
      }
    })
  );
  return buildDocsIndex(
    entries.filter((entry) => entry !== null),
    headingSlug
  );
}
