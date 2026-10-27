import type { Locale } from '../common/locale';
import type { TranslatedText } from '../documents/document-texts';

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
