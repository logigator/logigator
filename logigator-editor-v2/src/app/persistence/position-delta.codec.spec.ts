import { describe, expect, it } from 'vitest';
import {
  decodeComponentPositions,
  encodeComponentPositions,
  PositionDeltaDecodeError
} from './position-delta.codec';
import { SerializedComponentBody } from './serialized-circuit';

const comp = (
  type: number,
  x: number,
  y: number,
  options: Record<string, unknown> = {}
): SerializedComponentBody => ({ type, pos: [x, y], options });

describe('position-delta codec', () => {
  it('sorts by (type, y, x) and stores each pos relative to the previous', () => {
    const input = [comp(2, 10, 10), comp(1, 4, 20), comp(1, 8, 5)];
    const { components, order } = encodeComponentPositions(input);

    // Sorted: type 1 @(8,5), type 1 @(4,20), type 2 @(10,10).
    expect(order).toEqual([2, 1, 0]);
    expect(components.map((c) => c.pos)).toEqual([
      [8, 5],
      [-4, 15],
      [6, -10]
    ]);
  });

  it('round-trips absolute positions through encode → decode', () => {
    const input = [
      comp(5, -3, 7, { direction: 1 }),
      comp(1, 100, 200),
      comp(5, -3, 2),
      comp(1, 0, 0)
    ];
    const { components, order } = encodeComponentPositions(input);
    const decoded = decodeComponentPositions(components);

    // Decoded order is the emission order; each entry matches its source.
    expect(decoded).toEqual(order.map((i) => input[i]));
  });

  it('does not mutate the input components', () => {
    const input = [comp(1, 3, 4), comp(1, 9, 4)];
    encodeComponentPositions(input);
    expect(input.map((c) => c.pos)).toEqual([
      [3, 4],
      [9, 4]
    ]);
  });

  it('preserves negation and option fields through the re-encode', () => {
    const input = [
      { ...comp(2, 5, 5, { numInputs: 3 }), negInputs: [1] },
      comp(2, 1, 1)
    ];
    const { components, order } = encodeComponentPositions(input);
    const decoded = decodeComponentPositions(components);
    expect(decoded).toEqual(order.map((i) => input[i]));
  });

  it('rejects an entry whose pos is not a number pair', () => {
    const broken = [
      comp(1, 0, 0),
      { type: 1, pos: 'nope', options: {} }
    ] as unknown as SerializedComponentBody[];
    expect(() => decodeComponentPositions(broken)).toThrow(
      PositionDeltaDecodeError
    );
  });
});
