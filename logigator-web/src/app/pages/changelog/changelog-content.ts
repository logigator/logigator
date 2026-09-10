import { LanguageId } from '@logigator/core';
import { Changelog, parseChangelog } from '@logigator/docs';

/**
 * The changelog's markdown, one dynamic import per language.
 *
 * The same shape the documentation pages and the legal documents have, for the
 * same reason: `.md` is a `text` loader here, so each language compiles into a
 * chunk of its own instead of riding in the locale table every page carries.
 * The server render reads the one it draws off disk and the browser downloads
 * exactly that language, hashed and cached past the visit.
 *
 * The imports are written out rather than assembled from a template literal, so
 * `Record<LanguageId, …>` makes a language with no file a compile error.
 */
const CONTENT: Record<LanguageId, () => Promise<{ default: string }>> = {
  en: () => import('@logigator/docs/changelog/en.md'),
  de: () => import('@logigator/docs/changelog/de.md'),
  fr: () => import('@logigator/docs/changelog/fr.md'),
  es: () => import('@logigator/docs/changelog/es.md')
};

/**
 * Parsed documents, kept as module state the way the documentation index is: a
 * server request has its own injector, so a provider-held cache would be built
 * again for every visitor. It holds the promise rather than the document, so
 * two requests arriving on a cold language share one parse.
 */
const PARSED = new Map<LanguageId, Promise<Changelog>>();

/** The changelog in one language, split into its releases. */
export function loadChangelog(lang: LanguageId): Promise<Changelog> {
  let pending = PARSED.get(lang);
  if (!pending) {
    pending = CONTENT[lang]().then(({ default: markdown }) =>
      parseChangelog(markdown)
    );
    PARSED.set(lang, pending);
  }
  return pending;
}
