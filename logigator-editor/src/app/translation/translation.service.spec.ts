import { describe, expect, it } from 'vitest';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  // The strict key/result typing lives on this wrapper. If `translate` ever
  // widens to accept an arbitrary string, the `@ts-expect-error` below turns
  // into an unused-directive compile error and fails the build.
  it('accepts only known translation keys at compile time', () => {
    const translation = {} as TranslationService;
    const check = (): void => {
      translation.translate('theming.light');
      // @ts-expect-error not a real translation key
      translation.translate('this.is.not.a.real.key');
    };
    expect(check).toBeTypeOf('function');
  });
});
