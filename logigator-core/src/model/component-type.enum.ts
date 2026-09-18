// Values are fixed by the document format.
export enum BuiltInComponentType {
  NOT = 1,
  AND = 2,
  OR = 3,
  XOR = 4,
  DELAY = 5,
  CLOCK = 6,
  TEXT = 7,
  TUNNEL = 8,
  HALF_ADDER = 10,
  FULL_ADDER = 11,
  ROM = 12,
  D_FF = 13,
  JK_FF = 14,
  SR_FF = 15,
  RNG = 16,
  RAM = 17,
  DECODER = 18,
  ENCODER = 19,
  MUX = 20,
  DEMUX = 21,
  // INPUT/OUTPUT plug components define a custom component's ports.
  INPUT = 100,
  OUTPUT = 101,
  // User-input components driving a running simulation.
  BUTTON = 200,
  // The document format names id 201 a lever; shown as a switch here.
  SWITCH = 201,
  LED = 202,
  SEGMENT_DISPLAY = 203,
  LED_MATRIX = 204
}

/** A runtime-allocated custom component type id ({@link CUSTOM_TYPE_ID_BASE}+). */
export type CustomComponentType = number;

/**
 * A component type id — a built-in or a runtime-allocated custom — written as
 * `t` in a document. Structurally `number`, since the union collapses, so the
 * named arm documents intent rather than constraining.
 */
export type ComponentType = BuiltInComponentType | CustomComponentType;

/**
 * Type ids at or above this are runtime-allocated custom components, built-ins
 * the fixed range below. A custom type id is session-global and stable across
 * every open project.
 */
export const CUSTOM_TYPE_ID_BASE = 1000;
