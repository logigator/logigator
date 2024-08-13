import { TranslationSchema } from './translation-schema.model';

type WithPrefix<Prefix extends string, Key extends string> = [Prefix] extends [
	never
]
	? `${Key}`
	: `${Prefix}.${Key}`;

export type TranslationKey<
	T extends object = TranslationSchema,
	Prefix extends string = never
> = {
	[P in string & keyof T]: T[P] extends object
		? TranslationKey<T[P], WithPrefix<Prefix, P>>
		: WithPrefix<Prefix, P>;
}[string & keyof T];

export type PartialTranslationKey<
	T extends object = TranslationSchema,
	Prefix extends string = never
> = {
	[P in string & keyof T]: T[P] extends object
		? Prefix | TranslationKey<T[P], WithPrefix<Prefix, P>>
		: Prefix | WithPrefix<Prefix, P>;
}[string & keyof T];
