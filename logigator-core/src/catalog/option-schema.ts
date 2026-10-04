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

export type OptionSchema =
  | NumberOptionSchema
  | SelectButtonOptionSchema
  | SelectDropdownOptionSchema
  | TextOptionSchema
  | TextAreaOptionSchema
  | MemoryOptionSchema;

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
