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
 * True for `any`, which no conditional type can inspect meaningfully. It keeps
 * `TranslateArgs<any>` a usable single branch; a *call* with an `any` key is a
 * separate matter (see below).
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** The interpolation params a key needs, one property per placeholder. */
export type TranslationParams<T extends TranslationKey> = Record<
  Placeholders<MessageAt<T>>,
  unknown
>;

/**
 * The argument list after the key: a params object where the message
 * interpolates placeholders, nothing where it doesn't. So a forgotten or
 * misnamed param is a build error rather than a `{{name}}` leaking into the UI.
 *
 * A key of union type — a `TranslationKey`-typed field, or a key built from an
 * enum — takes optional untyped params instead: the placeholder set isn't
 * knowable until the key is, and requiring the union of every member's
 * placeholders would make such a call impossible to write.
 *
 * A key typed `any` (a template context without a type, e.g. `let-o` on an
 * `<ng-template>` a library component fills) escapes none of this: TypeScript
 * resolves the arity of a generic rest tuple against every branch at once, so
 * such a call reports "Expected 2 arguments, but got 1" whatever the message
 * needs. Give the key a type — translate in TypeScript and pass the text in,
 * the way `HexEditorComponent` builds its select-button options.
 */
export type TranslateArgs<T extends TranslationKey> =
  IsAny<T> extends true
    ? [params?: Record<string, unknown>]
    : IsUnion<T> extends true
      ? [params?: Record<string, unknown>]
      : [Placeholders<MessageAt<T>>] extends [never]
        ? []
        : [params: TranslationParams<T>];
