import { TranslateArgs } from './translate-args.model';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';

/**
 * The strictly typed `t` a template receives from `TranslateDirective`: schema
 * keys only, with the params that key interpolates, returning the schema's type
 * at that key.
 */
export type TranslateFn = <T extends TranslationKey>(
  key: T,
  ...params: TranslateArgs<T>
) => TranslationResult<T>;
