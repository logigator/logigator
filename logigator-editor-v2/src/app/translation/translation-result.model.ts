import type { TranslationSchema } from './translation-schema.model';

export type TranslationResult<
	Path extends string,
	T extends Record<string, unknown> = TranslationSchema
> = Path extends `${infer Prefix}.${infer Rest}`
	? T[Prefix] extends Record<string, unknown>
		? TranslationResult<Rest, T[Prefix]>
		: never
	: T[Path];
