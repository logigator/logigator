import { describe, expect, it } from 'vitest';
import {
  decodeWireChain,
  encodeWireChain,
  WireChainDecodeError
} from './wire-chain.codec';
import { SerializedWireBody } from '../model/serialized-circuit';
import { WireDirection } from '../model/wire-direction.enum';

const H = WireDirection.HORIZONTAL;
const V = WireDirection.VERTICAL;

const wire = (
  x: number,
  y: number,
  direction: WireDirection,
  length: number
): SerializedWireBody => ({ pos: [x, y], direction, length });

/** Canonical multiset view: same wires regardless of order. */
const canon = (wires: SerializedWireBody[]): string[] =>
  wires.map((w) => `${w.pos[0]},${w.pos[1]},${w.direction},${w.length}`).sort();

describe('wire-chain codec', () => {
  it('encodes a connected L-run as a single chunk', () => {
    const { text } = encodeWireChain([wire(3, 4, H, 5), wire(8, 4, V, 2)]);
    expect(text).toBe('3,4:e5s2');
  });

  it('walks a wire entered from its far end as w/n with the same canonical decode', () => {
    // Second wire's canonical pos (west end) is at the walk's far side: the
    // walk reaches (10,4) and the next wire spans (6,4)–(10,4).
    const input = [wire(3, 4, H, 7), wire(6, 6, V, -2), wire(6, 4, H, 4)];
    const { text } = encodeWireChain(input);
    expect(text).toBe('3,4:e7w4s2');
    expect(canon(decodeWireChain(text))).toEqual(
      canon([wire(3, 4, H, 7), wire(6, 4, V, 2), wire(6, 4, H, 4)])
    );
  });

  it('starts a new chunk for the leftover branch of a T-junction', () => {
    const input = [wire(0, 0, H, 4), wire(4, 0, H, 4), wire(4, 0, V, 3)];
    const { text, order } = encodeWireChain(input);
    const chunks = text.split(';');
    expect(chunks).toHaveLength(2);
    expect(order).toHaveLength(3);
    expect(canon(decodeWireChain(text))).toEqual(canon(input));
  });

  it('emits decoded wires in emission order (the wireIds contract)', () => {
    const input = [
      wire(0, 0, H, 4),
      wire(20, 20, V, 5), // disconnected — must come out at order[1]'s position
      wire(4, 0, V, 3)
    ];
    const { text, order } = encodeWireChain(input);
    const decoded = decodeWireChain(text);
    expect(decoded.map((w) => canon([w])[0])).toEqual(
      order.map((i) => canon([input[i]])[0])
    );
  });

  it('round-trips a randomized grid of touching and disconnected wires', () => {
    const input: SerializedWireBody[] = [];
    // Deterministic pseudo-random layout: rows of touching runs + strays.
    for (let i = 0; i < 40; i++) {
      const x = (i * 7) % 23;
      const y = (i * 13) % 17;
      input.push(wire(x, y, (i % 2) as WireDirection, 1 + (i % 5)));
    }
    const { text } = encodeWireChain(input);
    expect(canon(decodeWireChain(text))).toEqual(canon(input));
  });

  it('emits chunk heads relative to the previous chunk head', () => {
    const input = [wire(10, 10, H, 2), wire(4, 20, H, 2)];
    const { text } = encodeWireChain(input);
    expect(text).toBe('10,10:e2;-6,10:e2');
    expect(canon(decodeWireChain(text))).toEqual(canon(input));
  });

  it('produces the same text regardless of input order (canonical start sort)', () => {
    const a = [wire(10, 10, H, 2), wire(4, 20, H, 2), wire(0, 0, V, 3)];
    const b = [a[2], a[0], a[1]];
    expect(encodeWireChain(b).text).toBe(encodeWireChain(a).text);
  });

  it('never reads a direction letter as part of a length (no exponent notation)', () => {
    expect(decodeWireChain('0,0:e1e3')).toEqual([
      { pos: [0, 0], direction: H, length: 1 },
      { pos: [1, 0], direction: H, length: 3 }
    ]);
  });

  it('normalizes legacy negative lengths to canonical wires', () => {
    const { text } = encodeWireChain([wire(5, 5, H, -3)]);
    expect(canon(decodeWireChain(text))).toEqual(canon([wire(2, 5, H, 3)]));
  });

  it('encodes no wires as the empty string and decodes it back', () => {
    expect(encodeWireChain([]).text).toBe('');
    expect(decodeWireChain('')).toEqual([]);
  });

  it.each([
    'garbage',
    '1,2:x5', // unknown direction letter
    '1,2:e', // missing length
    '1,2:e-3', // negative length
    '1,2:e5,s3', // separators between segments are not part of the grammar
    '1,2:e1e3x', // trailing garbage after valid segments
    'e5', // chunk without a start point
    '1;2:e5', // malformed head
    '1,2:', // chunk without segments
    '1,2:e5;;3,4:n1' // empty chunk
  ])('rejects malformed chain %j', (text) => {
    expect(() => decodeWireChain(text)).toThrow(WireChainDecodeError);
  });
});
