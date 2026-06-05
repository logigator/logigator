// Values match the old editor's ElementTypeId for wire-format compatibility.
export const enum BuiltInComponentType {
  NOT = 1,
  AND = 2,
  TEXT = 7,
  ROM = 12,
  // INPUT/OUTPUT plug components define a custom component's ports.
  INPUT = 100,
  OUTPUT = 101
}

/** A runtime-allocated custom component type id ({@link CUSTOM_TYPE_ID_BASE}+). */
export type CustomComponentType = number;

/**
 * A component type id — a named built-in or a runtime-allocated custom id; the
 * value written as `t` in the wire format. Structurally `number` (the union
 * collapses), so the named arm documents intent rather than constraining.
 */
export type ComponentType = BuiltInComponentType | CustomComponentType;

/**
 * Type ids at or above this are runtime-allocated custom components; built-ins
 * occupy the fixed {@link BuiltInComponentType} range below it. A custom type id
 * is session-global and stable across every open project for the lifetime of the
 * page. Mirrors the legacy editor's reserved high range.
 */
export const CUSTOM_TYPE_ID_BASE = 1000;
