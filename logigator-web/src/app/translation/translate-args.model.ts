import { TranslationKey } from './translation-key.model';
import { TranslationMessages } from './translation-schema.model';

/** The English message at a dot path, as a literal type. */
type MessageAt<
  Path extends string,
  T = TranslationMessages
> = Path extends `${infer Prefix}.${infer Rest}`
  ? Prefix extends keyof T
    ? MessageAt<Rest, T[Prefix]>
    : never
  : Path extends keyof T
    ? T[Path]
    : never;

/** The `{{name}}` placeholders a message interpolates. */
type Placeholders<S> = S extends `${string}{{${infer Name}}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** True for a union of keys, false for a single key. */
type IsUnion<T, U = T> = T extends U ? ([U] extends [T] ? false : true) : never;

/**
 * True for `any`, which no conditional type can inspect meaningfully, keeping
 * `TranslateArgs<any>` a single branch.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** The interpolation params a key needs, one property per placeholder. */
export type TranslationParams<T extends TranslationKey> = Record<
  Placeholders<MessageAt<T>>,
  unknown
>;

/**
 * The argument list after the key: a params object where the message
 * interpolates placeholders, nothing where it doesn't, so a forgotten or
 * misnamed param is a build error rather than a `{{name}}` in the UI.
 *
 * A key of union type takes optional untyped params instead: the placeholder
 * set is not knowable until the key is, and requiring the union of every
 * member's placeholders would make such a call impossible to write.
 *
 * A key typed `any` — an untyped template context, say — escapes none of this:
 * TypeScript resolves a generic rest tuple's arity against every branch at
 * once, so the call reports "Expected 2 arguments, but got 1" whatever the
 * message needs. Type the key, or translate in TypeScript and pass the text in.
 */
export type TranslateArgs<T extends TranslationKey> =
  IsAny<T> extends true
    ? [params?: Record<string, unknown>]
    : IsUnion<T> extends true
      ? [params?: Record<string, unknown>]
      : [Placeholders<MessageAt<T>>] extends [never]
        ? []
        : [params: TranslationParams<T>];
