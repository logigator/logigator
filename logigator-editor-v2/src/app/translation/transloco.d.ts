/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Observable } from 'rxjs';
import type {
  HashMap,
  TranslocoEvents,
  TranslocoScope
} from '@jsverse/transloco/lib/types';
import type {
  PartialTranslationKey,
  TranslationKey
} from './translation-key.model';
import type { TranslationResult } from './translation-result.model';
import type { TranslationSchema } from './translation-schema.model';
import type {
  AvailableLangs,
  LoadOptions,
  SetTranslationOptions
} from '@jsverse/transloco/lib/transloco.types';
import type { TranslocoLoader } from '@jsverse/transloco/lib/transloco.loader';
import type { TranslocoTranspiler } from '@jsverse/transloco/lib/transloco.transpiler';
import type { TranslocoMissingHandler } from '@jsverse/transloco/lib/transloco-missing-handler';
import type { TranslocoInterceptor } from '@jsverse/transloco/lib/transloco.interceptor';
import type { TranslocoConfig } from '@jsverse/transloco/lib/transloco.config';
import type { TranslocoFallbackStrategy } from '@jsverse/transloco/lib/transloco-fallback-strategy';
import type { Signal } from '@angular/core';

declare module '@jsverse/transloco' {
  function translate<T extends TranslationKey>(
    key: T,
    params?: HashMap,
    lang?: string
  ): TranslationResult<T>;

  function translateObject<T extends PartialTranslationKey>(
    key: T,
    params?: HashMap,
    lang?: string
  ): TranslationResult<T>;

  class TranslocoService {
    events$: Observable<TranslocoEvents>;
    langChanges$: Observable<string>;

    readonly config: TranslocoConfig & {
      scopeMapping?: HashMap<string>;
    };

    readonly activeLang: Signal<string>;

    translate<T extends TranslationKey>(
      key: T,
      params?: HashMap,
      lang?: string
    ): TranslationResult<T>;

    selectTranslate<T extends TranslationKey>(
      key: T,
      params?: HashMap,
      lang?: string | TranslocoScope | TranslocoScope[],
      _isObject?: boolean
    ): Observable<TranslationResult<T>>;

    translateObject<T extends PartialTranslationKey>(
      key: T,
      params?: HashMap,
      lang?: string
    ): TranslationResult<T>;

    getTranslation(): Map<string, TranslationSchema>;

    getTranslation(langOrScope: string): TranslationSchema;

    selectTranslation(lang?: string): Observable<TranslationSchema>;

    selectTranslateObject<T extends PartialTranslationKey>(
      key: T,
      params?: HashMap,
      lang?: string
    ): Observable<TranslationResult<T>>;

    constructor(
      loader: TranslocoLoader,
      parser: TranslocoTranspiler,
      missingHandler: TranslocoMissingHandler,
      interceptor: TranslocoInterceptor,
      userConfig: TranslocoConfig,
      fallbackStrategy: TranslocoFallbackStrategy
    );

    getDefaultLang(): string;

    setDefaultLang(lang: string): void;

    getActiveLang(): string;

    setActiveLang(lang: string): this;

    setAvailableLangs(langs: AvailableLangs): void;

    getAvailableLangs(): AvailableLangs;

    load(path: string, options?: LoadOptions): Observable<TranslationSchema>;

    setTranslation(
      translation: TranslationSchema,
      lang?: string,
      options?: SetTranslationOptions
    ): void;

    setTranslationKey(
      key: TranslationKey,
      value: string,
      options?: Omit<SetTranslationOptions, 'merge'>
    ): void;

    setFallbackLangForMissingTranslation({
      fallbackLang
    }: Pick<TranslocoConfig, 'fallbackLang'>): void;

    isLang(lang: string): boolean;
  }
}
