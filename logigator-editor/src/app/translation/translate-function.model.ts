import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';

/**
 * The strictly typed `t` a template receives from `TranslateDirective`: it
 * accepts only keys the schema declares and returns the schema's type at that
 * key — the template-side counterpart of `TranslationService.translate`.
 */
export type TranslateFn = <T extends TranslationKey>(
  key: T,
  params?: Record<string, unknown>
) => TranslationResult<T>;
