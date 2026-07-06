import { Direction } from '../utils/direction';
import { BuiltInComponentType } from '../components/component-type.enum';

/**
 * Shared legacy-anchor geometry for the positional v0 format. The old editor
 * anchors a component by its body's top-left corner, held fixed across rotation;
 * editor-v2 anchors by the rotation pivot (body drawn from the local origin,
 * rotated around `position`). The two coincide only for {@link Direction.E}, so
 * rotated components must be re-anchored when crossing the v0 boundary.
 *
 * Single source of truth shared by the permanent `v0ToV1` migration (decode:
 * {@link legacyAnchorToPivot}) and the temporary server encoder (encode:
 * {@link pivotToLegacyAnchor}), mirroring how both already share
 * {@link LegacyV0Slots}.
 */

/**
 * Per-type body width (`bodyGridWidth`) for every v0 built-in, mirroring each
 * component's instance getter. FROZEN against the v1-era geometry: lets the
 * re-anchor run without instantiating a render object (which would consume a
 * global id and touch the texture cache). TEXT's body is a 1×1 anchor dot; its
 * floating label is decorative and excluded, matching the live `TextComponent`.
 */
export const LEGACY_BODY_WIDTHS: Record<number, number> = {
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
  [BuiltInComponentType.LEVER]: 1,
  [BuiltInComponentType.LED]: 1
};

/**
 * Per-type minimum body height for the v0 built-ins whose body is taller than
 * their port span (the old editor gave them room for the symbol), mirroring the
 * matching `bodyGridHeight` overrides. Absent types use the port span alone.
 */
const LEGACY_MIN_BODY_HEIGHTS: Record<number, number> = {
  [BuiltInComponentType.CLOCK]: 2,
  [BuiltInComponentType.RNG]: 2
};

/** Unrotated body height — mirrors `Component.bodyGridHeight` per type. */
export function legacyBodyHeight(
  type: number,
  numInputs: number,
  numOutputs: number
): number {
  return Math.max(
    LEGACY_MIN_BODY_HEIGHTS[type] ?? 1,
    1,
    numInputs,
    numOutputs
  );
}

/**
 * Legacy body top-left → v2 rotation pivot (decode). `w`/`h` are the unrotated
 * body grid size; mirrors the corner of `Component.bodyGridBounds`
 * (`_rotatedBounds(0, w, h)`).
 */
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

/** v2 rotation pivot → legacy body top-left (encode) — inverse of the above. */
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
