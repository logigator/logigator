import type en from '../../i18n/en';

/** Every leaf message replaced by `string`, structure untouched. */
type Widen<T> = {
  -readonly [P in keyof T]: T[P] extends string ? string : Widen<T[P]>;
};

/**
 * The shape every locale file must fill. Leaves are widened to `string` so a
 * translation may differ from the English text while the key structure stays a
 * build-time contract.
 */
export type TranslationSchema = Widen<typeof en>;

/**
 * The English messages with their literal text. Only the placeholder extraction
 * in `TranslateArgs` reads this; translated *results* are always `string`, since
 * the text depends on the active language.
 */
export type TranslationMessages = typeof en;
