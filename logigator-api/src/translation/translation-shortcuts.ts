import { normalizeAuthoredText } from '@logigator/core';
import { NOT_TRANSLATABLE } from './translation-reply';

/**
 * What a field needs before a document can be marked done:
 *
 * - `zxx`: nothing in it can be translated, which is decided here without a
 *   call;
 * - `human`: it is done only if its author has written it in every site
 *   language, since no reader is then shown the original;
 * - otherwise the model has to look at it.
 */
export type FieldShortcut = typeof NOT_TRANSLATABLE | 'human';

export interface DocumentShortcut {
  name: FieldShortcut;
  description: FieldShortcut;
}

/**
 * Digits, punctuation, symbols and spaces: a name made of these alone (`74`,
 * `2:1`, `+/-`) reads the same in every language, so the model has nothing to
 * detect and nothing to change.
 */
const LANGUAGELESS_NAME = /^[\p{N}\p{P}\p{S}\p{Zs}]*$/u;

/**
 * Whether a name has no linguistic content. A letter of any script makes it
 * the model's call, even in `74HC595`, where only the model can tell a part
 * number from a word.
 */
export function isLanguagelessName(name: string): boolean {
  return LANGUAGELESS_NAME.test(normalizeAuthoredText(name));
}

/**
 * How each field of a document could be settled without the model. The
 * document goes to the model unless both fields settle: one call translates
 * both, so a call made for one field leaves nothing to save on the other.
 */
export function documentShortcut(input: {
  name: string;
  description: string;
}): DocumentShortcut {
  return {
    name: isLanguagelessName(input.name) ? NOT_TRANSLATABLE : 'human',
    description:
      normalizeAuthoredText(input.description) === ''
        ? NOT_TRANSLATABLE
        : 'human'
  };
}
