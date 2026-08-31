import { Direction } from './direction';
import { BuiltInComponentType } from './component-type.enum';

/**
 * Anchor geometry for the positional v0 format. v0 anchors a component by its
 * body's top-left corner, held fixed across rotation; the native format anchors
 * by the rotation pivot (body drawn from the local origin, rotated around
 * `position`). The two coincide only for {@link Direction.E}, so rotated
 * components are re-anchored when crossing the v0 boundary.
 */

/**
 * Per-type body width for every v0 built-in, so the re-anchor runs without
 * instantiating a render object. FROZEN against the v1-era geometry. TEXT's
 * body is a 1×1 anchor dot; its floating label is decorative and excluded.
 * SEGMENT_DISPLAY is absent — its width is direction- and option-dependent (see
 * {@link legacyBodyWidth}).
 */
const LEGACY_BODY_WIDTHS: Record<number, number> = {
  [BuiltInComponentType.NOT]: 2,
  [BuiltInComponentType.AND]: 2,
  [BuiltInComponentType.OR]: 2,
  [BuiltInComponentType.XOR]: 2,
  [BuiltInComponentType.DELAY]: 2,
  [BuiltInComponentType.CLOCK]: 3,
  [BuiltInComponentType.TUNNEL]: 2,
  [BuiltInComponentType.HALF_ADDER]: 3,
  [BuiltInComponentType.FULL_ADDER]: 3,
  [BuiltInComponentType.TEXT]: 1,
  [BuiltInComponentType.ROM]: 3,
  [BuiltInComponentType.D_FF]: 3,
  [BuiltInComponentType.JK_FF]: 3,
  [BuiltInComponentType.SR_FF]: 3,
  [BuiltInComponentType.RNG]: 3,
  [BuiltInComponentType.RAM]: 3,
  [BuiltInComponentType.DECODER]: 3,
  [BuiltInComponentType.ENCODER]: 3,
  [BuiltInComponentType.MUX]: 3,
  [BuiltInComponentType.DEMUX]: 3,
  [BuiltInComponentType.INPUT]: 1,
  [BuiltInComponentType.OUTPUT]: 1,
  [BuiltInComponentType.BUTTON]: 1,
  [BuiltInComponentType.SWITCH]: 1,
  [BuiltInComponentType.LED]: 1
};

/**
 * Per-type minimum body height for the v0 built-ins whose body is taller than
 * their port span, to leave room for the symbol. Absent types use the port
 * span.
 */
const LEGACY_MIN_BODY_HEIGHTS: Record<number, number> = {
  [BuiltInComponentType.CLOCK]: 2,
  [BuiltInComponentType.RNG]: 2,
  [BuiltInComponentType.SEGMENT_DISPLAY]: 3
};

/** LED-matrix square body side per size option. */
function legacyMatrixCells(size: number | undefined): number {
  return size === 8 ? 12 : size === 16 ? 16 : 7;
}

/**
 * Unrotated body width. Only the segment display needs the extra context: its
 * width tracks the zero-padded readout (base in `n[0]`, digit count from the
 * input count) when horizontal, and is a fixed 4 when standing upright.
 */
export function legacyBodyWidth(
  type: number,
  direction: Direction,
  numInputs: number,
  n: readonly number[] | undefined
): number {
  if (type === BuiltInComponentType.LED_MATRIX) {
    return legacyMatrixCells(n?.[0]);
  }
  if (type === BuiltInComponentType.SEGMENT_DISPLAY) {
    if (direction % 2 === 1) {
      return 4;
    }
    switch (n?.[0] ?? 0) {
      case 1: // HEX
        return 2 + Math.ceil(numInputs / 4);
      case 2: // OCT
        return 2 + Math.ceil(numInputs / 3);
      default: // DEC
        return 2 + Math.ceil(Math.log10(2 ** numInputs + 1));
    }
  }
  return LEGACY_BODY_WIDTHS[type] ?? 1;
}

/**
 * Unrotated body height. `n` are the raw v0 option slots; only the LED matrix
 * (square, sized by `n[0]`) consults them.
 */
export function legacyBodyHeight(
  type: number,
  numInputs: number,
  numOutputs: number,
  n?: readonly number[]
): number {
  if (type === BuiltInComponentType.LED_MATRIX) {
    return legacyMatrixCells(n?.[0]);
  }
  return Math.max(LEGACY_MIN_BODY_HEIGHTS[type] ?? 1, 1, numInputs, numOutputs);
}

/**
 * Custom-component body grid width. Customs are not a built-in type, so they
 * are absent from {@link LEGACY_BODY_WIDTHS}. FROZEN alongside the built-in
 * widths.
 */
export const CUSTOM_BODY_GRID_WIDTH = 3;

/**
 * Unrotated body grid size of a custom instance: fixed width, height by the
 * port span. Port counts come from the resolved definition, so both sides of
 * the v0 boundary re-anchor a rotated custom about the same body extent.
 */
export function legacyCustomBodySize(
  numInputs: number,
  numOutputs: number
): { w: number; h: number } {
  return { w: CUSTOM_BODY_GRID_WIDTH, h: Math.max(1, numInputs, numOutputs) };
}

/** Legacy body top-left → rotation pivot; `w`/`h` are the unrotated size. */
export function legacyAnchorToPivot(
  px: number,
  py: number,
  direction: Direction,
  w: number,
  h: number
): [number, number] {
  switch (direction) {
    case Direction.S:
      return [px + h, py];
    case Direction.W:
      return [px + w, py + h];
    case Direction.N:
      return [px, py + w];
    case Direction.E:
    default:
      return [px, py];
  }
}

/** Rotation pivot → legacy body top-left; inverse of the above. */
export function pivotToLegacyAnchor(
  px: number,
  py: number,
  direction: Direction,
  w: number,
  h: number
): [number, number] {
  switch (direction) {
    case Direction.S:
      return [px - h, py];
    case Direction.W:
      return [px - w, py - h];
    case Direction.N:
      return [px, py - w];
    case Direction.E:
    default:
      return [px, py];
  }
}
