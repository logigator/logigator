import { LanguageId } from '@logigator/core';

/** The long-form legal pages, named by the path segment each is served under. */
export type LegalDocumentKind = 'imprint' | 'privacy-policy';

/** What a legal route tells the guard and the page which document it is. */
export interface LegalRouteData {
  legalDocument: LegalDocumentKind;
}

/**
 * Every document's markdown, one dynamic import each.
 *
 * The text is not in the locale table on purpose: that table is loaded for
 * every page and travels in each document's first byte, where the privacy
 * policy alone would add 60 kB per language. As a dynamic import it becomes a
 * chunk of its own on both bundles, so a server render reads it off disk and
 * the browser downloads exactly the one language it renders — hashed, and
 * therefore cached for good.
 *
 * The imports are written out rather than assembled from a template literal:
 * `Record<LanguageId, …>` then makes a language with no file a compile error
 * instead of a page that 404s in it.
 */
const CONTENT: Record<
  LegalDocumentKind,
  Record<LanguageId, () => Promise<{ default: string }>>
> = {
  imprint: {
    en: () => import('./content/imprint/en.md'),
    de: () => import('./content/imprint/de.md'),
    fr: () => import('./content/imprint/fr.md'),
    es: () => import('./content/imprint/es.md')
  },
  'privacy-policy': {
    en: () => import('./content/privacy-policy/en.md'),
    de: () => import('./content/privacy-policy/de.md'),
    fr: () => import('./content/privacy-policy/fr.md'),
    es: () => import('./content/privacy-policy/es.md')
  }
};

/** One document's markdown, in one language. */
export async function loadLegalDocument(
  kind: LegalDocumentKind,
  lang: LanguageId
): Promise<string> {
  return (await CONTENT[kind][lang]()).default;
}
