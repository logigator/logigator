import type { Locale } from '../common/locale';

/** One language's machine text; null where the field keeps the original. */
export interface TranslatedText {
  name: string | null;
  description: string | null;
}

/**
 * Detection and translation of one document, as they may be stored.
 *
 * Each language is ISO 639-1 or `zxx` (nothing to translate), and need not be
 * a site language. `texts` holds only languages in which at least one field
 * changes, so a language the model kept as written is simply absent.
 */
export interface DocumentTranslation {
  nameLanguage: string;
  descriptionLanguage: string;
  texts: Partial<Record<Locale, TranslatedText>>;
}
