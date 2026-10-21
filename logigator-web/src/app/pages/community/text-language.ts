/**
 * The API's mark for a text with nothing to translate (ISO 639-2 "no
 * linguistic content"). A language tag in name only: nothing should be read
 * or pronounced as being in it.
 */
const NO_LANGUAGE = 'zxx';

/**
 * A detected language that names a real one: neither unknown yet (`null`) nor
 * the not-translatable mark. Not limited to the site's languages.
 */
export function realLanguage(language: string | null): string | null {
  return language && language !== NO_LANGUAGE ? language : null;
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
