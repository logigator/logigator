export type EnsureLeadingChar<
	S extends string,
	C extends string
> = S extends `${C}${string}` ? S : `${C}${S}`;
export type EnsureTrailingChar<
	S extends string,
	C extends string
> = S extends `${string}${C}` ? S : `${S}${C}`;
