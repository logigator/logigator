import type { Observable } from 'rxjs';
import type { HashMap, TranslocoEvents, TranslocoScope } from '@jsverse/transloco/lib/types';
import type {
	PartialTranslationKey,
	TranslationKey
} from './translation-key.model';
import type { TranslationResult } from './translation-result.model';
import type { TranslationSchema } from './translation-schema.model';

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
	}
}
