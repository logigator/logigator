/**
 * The pure half of a component option: what values it accepts and what it
 * defaults to, with no renderer attached. The editor pairs each `kind` with a
 * `ComponentOption` subclass and the server validates documents against the
 * same schemas, so a legal value has one definition rather than one per side.
 *
 * `label`, `placeholder` and `dialogTitle` are translation keys, opaque here.
 */

/** One choice offered by a select option. */
export interface SelectOptionValue<T = unknown> {
  readonly value: T;
  readonly label?: string;
  readonly icon?: string;
}

interface OptionSchemaBase {
  /** Translation key of the option's inspector label. */
  readonly label: string;
  /**
   * Omits the option from the generic settings form. The value still
   * round-trips; it is system-managed, like a plug's `index`.
   */
  readonly hidden?: boolean;
}

export interface NumberOptionSchema extends OptionSchemaBase {
  readonly kind: 'number';
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/** A small, fixed choice set rendered as a segmented button group. */
export interface SelectButtonOptionSchema<
  T = unknown
> extends OptionSchemaBase {
  readonly kind: 'select-button';
  readonly values: readonly SelectOptionValue<T>[];
  readonly default: T;
}

/** The same choice semantics rendered as a dropdown, for longer lists. */
export interface SelectDropdownOptionSchema<
  T = unknown
> extends OptionSchemaBase {
  readonly kind: 'select-dropdown';
  readonly values: readonly SelectOptionValue<T>[];
  readonly default: T;
}

export interface TextOptionSchema extends OptionSchemaBase {
  readonly kind: 'text';
  readonly default: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  /**
   * Source of the character class stripped from every write. A string rather
   * than a `RegExp` because a schema is plain data crossing postMessage
   * boundaries, and a shared `/g` instance would carry `lastIndex` between
   * tests.
   */
  readonly forbiddenChars?: string;
}

export interface TextAreaOptionSchema extends OptionSchemaBase {
  readonly kind: 'textarea';
  readonly default: string;
  readonly dialogTitle?: string;
  readonly placeholder?: string;
  readonly maxLength: number;
}

/** Word-addressed memory contents as a base64 bit-packed blob. */
export interface MemoryOptionSchema extends OptionSchemaBase {
  readonly kind: 'memory';
  readonly default: string;
}

/** Custom names for a fixed set of keys, keyed by those keys. */
export type NameMap = Readonly<Record<string, string>>;

/**
 * Optional custom names for a fixed set of keys, as one value. A key that is
 * missing, or maps to an empty string, keeps its default name, which is the
 * owner's knowledge rather than the schema's.
 */
export interface NameMapOptionSchema extends OptionSchemaBase {
  readonly kind: 'name-map';
  /** The keys a name may be set for, in display order. */
  readonly keys: readonly string[];
  /** Longest name allowed for any one key. */
  readonly maxLength: number;
  /** Source of the character class no name may contain, as for `text`. */
  readonly forbiddenChars?: string;
  readonly default: NameMap;
}

export type OptionSchema =
  | NumberOptionSchema
  | SelectButtonOptionSchema
  | SelectDropdownOptionSchema
  | TextOptionSchema
  | TextAreaOptionSchema
  | MemoryOptionSchema
  | NameMapOptionSchema;

/** A component's option values, keyed the same way as its schemas. */
export type OptionValues = Readonly<Record<string, unknown>>;

/** The default value of every option in `schemas`. */
export function defaultOptionValues(
  schemas: Readonly<Record<string, OptionSchema>>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(schemas)) {
    values[key] = schema.default;
  }
  return values;
}

/**
 * The one spelling of a name map: every name trimmed, keys that end up empty
 * dropped, and the rest in `keys` order. A key outside `keys` or a value that
 * is not a string is dropped too. Two maps naming the same keys the same way
 * are then equal entry for entry and serialize to the same text.
 */
export function canonicalNameMap(
  keys: readonly string[],
  names: Readonly<Record<string, unknown>>
): Record<string, string> {
  const canonical: Record<string, string> = {};
  for (const key of keys) {
    if (!Object.hasOwn(names, key)) continue;
    const name = names[key];
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (trimmed) canonical[key] = trimmed;
  }
  return canonical;
}
