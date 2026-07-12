import { SerializedComponentBody } from './serialized-circuit';

/**
 * Delta codec for persisted component positions. Components are emitted sorted
 * by (type, y, x) and each `pos` is stored relative to the previous
 * component's absolute position (the first is relative to the origin). The
 * sort clusters nearby same-type components so the deltas are small, repeating
 * values — absolute coordinates are the high-entropy part of the document that
 * gzip cannot remove, deltas compress away almost entirely.
 *
 * Like the wire chain, encoding defines the document's component order;
 * consumers that align per-component data with the document
 * (`ProjectDump.componentIds`) map through the returned emission order.
 */

/** A decode failure: structurally invalid persisted component positions. */
export class PositionDeltaDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PositionDeltaDecodeError';
  }
}

export interface EncodedComponentPositions {
  components: SerializedComponentBody[];
  /** `order[k]` = index into the input array of the k-th emitted component. */
  order: number[];
}

/** Sorts by (type, y, x) and delta-encodes positions. Input is not mutated. */
export function encodeComponentPositions(
  components: readonly SerializedComponentBody[]
): EncodedComponentPositions {
  const order = components
    .map((_, i) => i)
    .sort((u, v) => {
      const a = components[u];
      const b = components[v];
      return (
        a.type - b.type || a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0] || u - v
      );
    });

  let px = 0;
  let py = 0;
  const encoded = order.map((i) => {
    const c = components[i];
    const delta: SerializedComponentBody = {
      ...c,
      pos: [c.pos[0] - px, c.pos[1] - py]
    };
    [px, py] = c.pos;
    return delta;
  });

  return { components: encoded, order };
}

function isNumberPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/**
 * Restores absolute positions from the delta encoding, in document order.
 * Throws {@link PositionDeltaDecodeError} when an entry's `pos` is not a
 * number pair (every entry contributes to the running position, so a broken
 * one poisons everything after it — fail the document instead).
 */
export function decodeComponentPositions(
  components: readonly SerializedComponentBody[]
): SerializedComponentBody[] {
  let px = 0;
  let py = 0;
  return components.map((c) => {
    if (!c || !isNumberPair(c.pos)) {
      throw new PositionDeltaDecodeError('Invalid component in file');
    }
    px += c.pos[0];
    py += c.pos[1];
    return { ...c, pos: [px, py] };
  });
}
