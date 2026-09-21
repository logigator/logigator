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

  it("starts a walk at a run's end, so an L is one chunk rather than two", () => {
    // Both wires leave (0,0); a walk started there covers one and dead-ends.
    const input = [wire(0, 0, H, 4), wire(0, 0, V, 4)];
    expect(encodeWireChain(input).text).toBe('4,0:w4s4');
  });

  it('emits a straight run as one chunk of repeated segments, whatever order it arrives in', () => {
    const run = [
      wire(0, 0, H, 2),
      wire(2, 0, H, 2),
      wire(4, 0, H, 2),
      wire(6, 0, H, 2)
    ];
    const scrambled = [run[2], run[0], run[3], run[1]];
    expect(encodeWireChain(scrambled).text).toBe('0,0:e2e2e2e2');
  });

  it('continues straight through a junction that also offers a turn', () => {
    // A dangling run into the south-west corner of a loop. At (4,0) the walk
    // can turn north into the loop or carry on east; the northbound wire is
    // the earlier one in canonical (y, x) order, so only straight-first
    // continuation keeps `e4e4` together — and the whole graph stays one walk.
    const input = [
      wire(0, 0, H, 4), // the run into the junction
      wire(4, -3, V, 3), // the turn: canonically first at the junction
      wire(4, 0, H, 4), // straight on
      wire(4, -3, H, 4),
      wire(8, -3, V, 3)
    ];
    expect(encodeWireChain(input).text).toBe('0,0:e4e4n3w4s3');
  });

  it('emits every wire of a graph whose vertices outlive one walk', () => {
    // Overlapping collinear wires — a board that violates the editor's wire
    // invariants, which is what `wire-repair` is for, and which must still
    // survive a save. Two rails drawn both whole and in pieces: a walk leaves
    // a vertex by one wire and can get stuck elsewhere, so an odd-degree
    // vertex is left holding wires that only a second walk from it picks up.
    // Reduced from a fuzz failure; exhaustively minimal for this lattice.
    const input = [
      wire(0, 0, H, 1),
      wire(0, 0, V, 2),
      wire(0, 1, H, 1),
      wire(0, 1, V, 1),
      wire(1, 0, V, 1),
      wire(1, 0, V, 2),
      wire(1, 1, V, 1)
    ];
    const decoded = decodeWireChain(encodeWireChain(input).text);
    expect(decoded).toHaveLength(input.length);
    expect(canon(decoded)).toEqual(canon(input));
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

/** Deterministic shuffle, so "the input's order does not reach the output" is
 * a fact of the run rather than of one hand-written permutation. */
const shuffled = (
  wires: SerializedWireBody[],
  seed: number
): SerializedWireBody[] => {
  const out = [...wires];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const shift = (
  wires: SerializedWireBody[],
  dx: number,
  dy: number
): SerializedWireBody[] =>
  wires.map((w) => wire(w.pos[0] + dx, w.pos[1] + dy, w.direction, w.length));

/** Every edge of a `cols × rows` unit lattice: degree-4 junctions throughout,
 * where a walk has both a straight continuation and two turns to choose from. */
const lattice = (cols: number, rows: number): SerializedWireBody[] => {
  const out: SerializedWireBody[] = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x < cols; x++) out.push(wire(x, y, H, 1));
  }
  for (let x = 0; x <= cols; x++) {
    for (let y = 0; y < rows; y++) out.push(wire(x, y, V, 1));
  }
  return out;
};

/** A binary tree fanning south: no cycle, and a degree-1 leaf per branch. */
const tree = (): SerializedWireBody[] => {
  const out: SerializedWireBody[] = [];
  const grow = (x: number, y: number, span: number, level: number): void => {
    if (level === 0) return;
    out.push(wire(x, y, V, 2));
    out.push(wire(x - span, y + 2, H, span));
    out.push(wire(x, y + 2, H, span));
    grow(x - span, y + 2, span / 2, level - 1);
    grow(x + span, y + 2, span / 2, level - 1);
  };
  grow(0, 0, 8, 4);
  return out;
};

/** A closed rectangle: every vertex degree 2, so no walk can start at an end. */
const cycle = (): SerializedWireBody[] => [
  wire(0, 0, H, 4),
  wire(4, 0, V, 4),
  wire(0, 4, H, 4),
  wire(0, 0, V, 4)
];

const strays = (): SerializedWireBody[] => [
  wire(0, 0, H, 3),
  wire(40, 5, V, 7),
  wire(-20, -9, H, 1),
  wire(13, 60, V, 2)
];

/** Wires laid over each other, which the lattice, tree and cycle cannot
 * produce: a rail drawn whole and again in pieces. Boards like this violate
 * the editor's wire invariants — `wire-repair` heals them, and only when the
 * user asks — so saving one has to give every wire back untouched. */
const overlapping = (): SerializedWireBody[] => [
  wire(0, 0, V, 3),
  wire(0, 0, V, 1),
  wire(0, 1, V, 2),
  wire(2, 0, V, 3),
  wire(2, 0, V, 2),
  wire(2, 2, V, 1),
  wire(0, 0, H, 2),
  wire(0, 1, H, 2),
  wire(0, 1, H, 1),
  wire(1, 1, H, 1),
  wire(0, 3, H, 2)
];

/** The wire set a fuzz run caught the traversal dropping: every vertex of a
 * 2×2 lattice joined by every wire that fits, so several carry an odd number
 * of overlapping wires. */
const fuzzDrop = (): SerializedWireBody[] => [
  wire(0, 1, H, 3),
  wire(1, 1, V, 1),
  wire(1, 0, H, 2),
  wire(0, 0, H, 3),
  wire(1, 1, H, 2),
  wire(0, 0, V, 3),
  wire(1, 0, V, 1),
  wire(0, 1, V, 2),
  wire(1, 0, V, 2),
  wire(0, 0, V, 2),
  wire(0, 0, V, 1),
  wire(0, 1, V, 1)
];

const GRAPHS: Record<string, SerializedWireBody[]> = {
  lattice: lattice(6, 5),
  tree: tree(),
  cycle: cycle(),
  'single wire': [wire(3, 7, V, 2)],
  disconnected: strays(),
  'overlapping collinear wires': overlapping(),
  'overlapping collinear wires (from a fuzz failure)': fuzzDrop(),
  mixed: [
    ...lattice(4, 3),
    ...shift(tree(), 200, 0),
    ...shift(cycle(), 0, 400),
    ...shift(strays(), 600, 600),
    ...shift(overlapping(), 800, 0),
    ...shift(fuzzDrop(), 800, 800)
  ]
};

describe('wire-chain traversal', () => {
  it.each(Object.keys(GRAPHS))(
    'round-trips a %s to the same wire set, in the order it reports',
    (name) => {
      const input = GRAPHS[name];
      const { text, order } = encodeWireChain(input);
      const decoded = decodeWireChain(text);

      expect(decoded).toHaveLength(input.length);
      expect(canon(decoded)).toEqual(canon(input));
      // `order` is a permutation of the input indices…
      expect([...order].sort((a, b) => a - b)).toEqual(input.map((_, i) => i));
      // …and names the decoded wires position by position, which is what the
      // body's wire ids are resolved against.
      expect(decoded.map((w) => canon([w])[0])).toEqual(
        order.map((i) => canon([input[i]])[0])
      );
    }
  );

  it.each(Object.keys(GRAPHS))(
    'encodes a %s identically however the wires are ordered',
    (name) => {
      const input = GRAPHS[name];
      const { text } = encodeWireChain(input);
      expect(encodeWireChain(input).text).toBe(text);
      for (const seed of [1, 99, 4711]) {
        expect(encodeWireChain(shuffled(input, seed)).text).toBe(text);
      }
    }
  );

  it('re-encodes its own output unchanged, so a re-save is byte-identical', () => {
    for (const input of Object.values(GRAPHS)) {
      const { text } = encodeWireChain(input);
      expect(encodeWireChain(decodeWireChain(text)).text).toBe(text);
    }
  });
});
