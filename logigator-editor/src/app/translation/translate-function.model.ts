import { TranslateArgs } from './translate-args.model';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';

/**
 * The strictly typed `t` a template receives from `TranslateDirective`: it
 * accepts only keys the schema declares along with the params that key
 * interpolates, and returns the schema's type at that key — the template-side
 * counterpart of `TranslationService.translate`.
 */
export type TranslateFn = <T extends TranslationKey>(
  key: T,
  ...params: TranslateArgs<T>
) => TranslationResult<T>;
