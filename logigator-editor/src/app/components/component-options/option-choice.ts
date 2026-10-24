import { TranslationKey } from '../../translation/translation-key.model';
import { TranslationService } from '../../translation/translation.service';

/** One choice of a select option, as its renderer offers it. */
export interface OptionChoice<T> {
  value: T;
  /** Shown as written, for a literal such as `HEX`. */
  label?: string;
  /** A caption that is a word, translated; wins over `label`. */
  labelKey?: TranslationKey;
  icon?: string;
}

/**
 * The choices with every `labelKey` resolved into `label`. Live inside a
 * reactive context, so a language switch re-captions them.
 */
export function captionedChoices<T>(
  translation: TranslationService,
  choices: readonly OptionChoice<T>[]
): OptionChoice<T>[] {
  return choices.map((choice) =>
    choice.labelKey
      ? { ...choice, label: translation.translate(choice.labelKey) }
      : choice
  );
}
