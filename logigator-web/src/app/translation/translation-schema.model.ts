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
 * The English messages with their literal text, read only by `TranslateArgs`'s
 * placeholder extraction; translated results are always `string`.
 */
export type TranslationMessages = typeof en;
