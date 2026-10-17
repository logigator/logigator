/**
 * One kind of storage the consent surfaces list. A `required` one is drawn as
 * a switch that is on and locked, and never appears in a decision: nobody is
 * asked about it.
 */
export interface LgConsentCategory {
  id: string;
  title: string;
  description: string;
  required?: boolean;
}

/**
 * Every word the consent banner and its preferences dialog show. The library
 * holds none of them: the copy is the consumer's translation, and both apps on
 * the origin hand over the same text so a visitor reads one question wherever
 * it is asked.
 */
export interface LgConsentCopy {
  title: string;
  text: string;
  /** The link beside {@link text}, opened in a new tab so nothing is lost. */
  privacyLabel: string;
  privacyHref: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  /** The preferences dialog's header and the paragraph that opens it. */
  preferencesTitle: string;
  preferencesText: string;
  save: string;
  categories: readonly LgConsentCategory[];
}

/** The ids of every category a visitor can refuse. */
export function optionalCategoryIds(copy: LgConsentCopy): string[] {
  return copy.categories
    .filter((category) => !category.required)
    .map((category) => category.id);
}
