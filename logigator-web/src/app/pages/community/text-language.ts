import { NOT_TRANSLATABLE } from '@logigator/contract';

/**
 * A detected language that names a real one: neither unknown yet (`null`) nor
 * the not-translatable mark. Not limited to the site's languages.
 */
export function realLanguage(language: string | null): string | null {
  return language && language !== NOT_TRANSLATABLE ? language : null;
}

/**
 * The `lang` attribute an element showing a text in `language` needs on a page
 * in `pageLanguage`: none where the text is in the page's own language, and
 * none where the language is unknown or there is none, since a wrong tag is
 * worse than an inherited one.
 */
export function textLangAttribute(
  language: string | null,
  pageLanguage: string
): string | null {
  const real = realLanguage(language);
  return real && real !== pageLanguage ? real : null;
}
