// Values match the old editor's ElementTypeId for wire-format compatibility.
export const enum ComponentType {
	NOT = 1,
	AND = 2,
	TEXT = 7,
	ROM = 12,
	// INPUT/OUTPUT plug components define a custom component's ports.
	INPUT = 100,
	OUTPUT = 101
}

/**
 * Numeric type ids at or above this are runtime-allocated custom components;
 * built-ins occupy the fixed {@link ComponentType} range below it. A custom
 * type id is session-global and stable across every open project for the
 * lifetime of the page. Mirrors the legacy editor's reserved high range.
 */
export const CUSTOM_TYPE_ID_BASE = 1000;
