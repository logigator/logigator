import { CONSENT_CATEGORIES, type ConsentCategory } from '../consent-cookie';

/** What the consent question describes: the storage nobody is asked about,
 * then every category a visitor can refuse. */
export type ConsentTopic = 'necessary' | ConsentCategory;

/**
 * The consent question's words in one language. Both apps put it in their
 * translation tables under `consent`, so the text is written once and still
 * loads with the rest of a language.
 *
 * Each language is a module of its own that the barrel does not re-export: a
 * locale file imports `@logigator/core/consent-text/<lang>` by path.
 * Re-exported, every language would be reachable from the app's main bundle,
 * which imports the barrel, and the bundler would put all four there.
 *
 * `categories` is keyed by {@link ConsentTopic}, so a category added to
 * `CONSENT_CATEGORIES` does not compile until every language describes it.
 * Rewording what a category covers asks for more than a new sentence: it is a
 * new question, and `CONSENT_REVISION` has to be bumped with it.
 */
export interface ConsentText {
  title: string;
  text: string;
  privacy: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  preferencesTitle: string;
  preferencesText: string;
  save: string;
  categories: Record<ConsentTopic, { title: string; description: string }>;
}

/** A message's path inside {@link ConsentText}, as a translation key names it. */
export type ConsentTextKey =
  | Exclude<keyof ConsentText, 'categories'>
  | `categories.${ConsentTopic}.${'title' | 'description'}`;

/** One entry of {@link ConsentCopy.categories}. */
export interface ConsentCopyCategory {
  id: ConsentTopic;
  title: string;
  description: string;
  required?: boolean;
}

/** The consent question as the banner and its dialog draw it. */
export interface ConsentCopy extends Omit<
  ConsentText,
  'privacy' | 'categories'
> {
  privacyLabel: string;
  privacyHref: string;
  categories: ConsentCopyCategory[];
}

const TOPICS: readonly ConsentTopic[] = ['necessary', ...CONSENT_CATEGORIES];

/**
 * The consent question, each message looked up through `translate` — so an
 * app reads it through its own translation service and a switch of language
 * reaches it the way it reaches every other string.
 */
export function consentCopy(
  translate: (key: ConsentTextKey) => string,
  privacyHref: string
): ConsentCopy {
  return {
    title: translate('title'),
    text: translate('text'),
    privacyLabel: translate('privacy'),
    privacyHref,
    acceptAll: translate('acceptAll'),
    rejectAll: translate('rejectAll'),
    customize: translate('customize'),
    preferencesTitle: translate('preferencesTitle'),
    preferencesText: translate('preferencesText'),
    save: translate('save'),
    categories: TOPICS.map((id) => ({
      id,
      title: translate(`categories.${id}.title`),
      description: translate(`categories.${id}.description`),
      ...(id === 'necessary' ? { required: true } : {})
    }))
  };
}
