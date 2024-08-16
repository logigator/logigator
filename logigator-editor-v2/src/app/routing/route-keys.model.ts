import type {
	EnsureLeadingChar,
	EnsureTrailingChar
} from '../utils/string.type';

type _RouteKeys<S extends string> = S extends `${string}/:${infer T}/${infer U}`
	? T extends `${infer V}?${string}`
		? { [K in V]: string | null } & RouteKeys<`/${U}`>
		: T extends `${infer V}.${string}`
			? { [K in V]: string } & RouteKeys<`/${U}`>
			: { [K in T]: string } & RouteKeys<`/${U}`>
	: Record<string, string | null>;

export type RouteKeys<S extends string> = _RouteKeys<
	EnsureLeadingChar<EnsureTrailingChar<S, '/'>, '/'>
>;
