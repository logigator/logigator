import { SerializedWireBody } from '../model/serialized-circuit';
import { WireDirection } from '../model/wire-direction.enum';

/**
 * Chain codec for the persisted wire encoding: SVG-path-style walks over the
 * wire graph, `"x,y:e5s3;x,y:n2"`. Each chunk starts at a point; every segment
 * is one wire leaving the current point (`e`/`s`/`w`/`n` + length, no separator
 * needed since the next letter ends the number), and its far endpoint starts
 * the next segment. Chunk heads are deltas against the previous head, the first
 * against the origin, and walks start in (y, x) order — so nearby chunks open
 * with small repeating deltas rather than high-entropy absolutes, which is
 * where the compressed size win comes from.
 *
 * The four letters describe the walk, not the wire: the in-memory model stays
 * canonical (horizontal/vertical, positive length, `pos` at the west/north
 * endpoint), and `w`/`n` mean the walk entered the wire from its far end.
 * Decoding normalizes back, so a document round-trips to the same wire set in
 * emission order — which is what defines the body's wire order.
 */

/** A decode failure: structurally invalid chain text. */
export class WireChainDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WireChainDecodeError';
  }
}

export interface EncodedWireChain {
  text: string;
  /** `order[k]` = index into the input array of the k-th emitted wire. */
  order: number[];
}

type GridPoint = [number, number];

/** A wire's two endpoints; the second may lie west/north of `pos` for a
 * negative length, which encoding normalizes. */
function endpointsOf(wire: SerializedWireBody): [GridPoint, GridPoint] {
  const [x, y] = wire.pos;
  return wire.direction === WireDirection.HORIZONTAL
    ? [
        [x, y],
        [x + wire.length, y]
      ]
    : [
        [x, y],
        [x, y + wire.length]
      ];
}

const keyOf = (p: GridPoint): string => `${p[0]},${p[1]}`;

/**
 * Encodes wires as chain text. Deterministic: chunks start at the first
 * not-yet-emitted wire in (y, x) order of the canonical west/north start point,
 * and each walk greedily continues with the first unused wire incident to the
 * current point, indexed from both endpoints so a wire is picked up from either
 * end.
 */
export function encodeWireChain(
  wires: readonly SerializedWireBody[]
): EncodedWireChain {
  const ends = wires.map(endpointsOf);
  // Canonical start: the west/north endpoint, which equals `pos` unless a
  // negative length swapped them.
  const startOf = (i: number): GridPoint => {
    const [a, b] = ends[i];
    return b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a;
  };
  const sorted = wires
    .map((_, i) => i)
    .sort((u, v) => {
      const a = startOf(u);
      const b = startOf(v);
      return a[1] - b[1] || a[0] - b[0] || u - v;
    });

  const adjacency = new Map<string, number[]>();
  for (const i of sorted) {
    for (const p of ends[i]) {
      const key = keyOf(p);
      const list = adjacency.get(key);
      if (list) list.push(i);
      else adjacency.set(key, [i]);
    }
  }

  const used = new Array<boolean>(wires.length).fill(false);
  const order: number[] = [];
  const chunks: string[] = [];

  const segmentFrom = (cur: GridPoint, index: number): [string, GridPoint] => {
    const [a, b] = ends[index];
    const other = a[0] === cur[0] && a[1] === cur[1] ? b : a;
    const horizontal = wires[index].direction === WireDirection.HORIZONTAL;
    const delta = horizontal ? other[0] - cur[0] : other[1] - cur[1];
    const letter = horizontal ? (delta < 0 ? 'w' : 'e') : delta < 0 ? 'n' : 's';
    return [letter + Math.abs(delta), other];
  };

  let prevHead: GridPoint = [0, 0];
  for (const start of sorted) {
    if (used[start]) continue;
    used[start] = true;
    order.push(start);
    const origin = startOf(start);
    const head = `${origin[0] - prevHead[0]},${origin[1] - prevHead[1]}`;
    prevHead = origin;
    const segments: string[] = [];
    let [seg, cur] = segmentFrom(origin, start);
    segments.push(seg);
    for (;;) {
      const candidate = (adjacency.get(keyOf(cur)) ?? []).find((i) => !used[i]);
      if (candidate === undefined) break;
      used[candidate] = true;
      order.push(candidate);
      [seg, cur] = segmentFrom(cur, candidate);
      segments.push(seg);
    }
    chunks.push(`${head}:${segments.join('')}`);
  }

  return { text: chunks.join(';'), order };
}

const HEAD_PATTERN = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
// Sticky tokenizer: segments abut with no separator, so each match must start
// exactly where the previous ended. Digits and dot only, so `e` reads as a
// direction letter rather than an exponent.
const SEGMENT_PATTERN = /([eswn])(\d+(?:\.\d+)?)/y;

/**
 * Decodes chain text back to canonical wire bodies (positive length, `pos` at
 * the west/north endpoint), in emission order. Throws
 * {@link WireChainDecodeError} on anything structurally invalid.
 */
export function decodeWireChain(text: string): SerializedWireBody[] {
  if (typeof text !== 'string') {
    throw new WireChainDecodeError('Wire chain must be a string');
  }
  const wires: SerializedWireBody[] = [];
  if (text === '') return wires;

  // Chunk heads are deltas against the previous chunk's head.
  let hx = 0;
  let hy = 0;
  for (const chunk of text.split(';')) {
    const colon = chunk.indexOf(':');
    const head = colon === -1 ? null : HEAD_PATTERN.exec(chunk.slice(0, colon));
    if (!head) {
      throw new WireChainDecodeError(`Invalid wire chain chunk "${chunk}"`);
    }
    hx += Number(head[1]);
    hy += Number(head[2]);
    let x = hx;
    let y = hy;
    const body = chunk.slice(colon + 1);
    if (body === '') {
      throw new WireChainDecodeError(`Invalid wire chain chunk "${chunk}"`);
    }
    SEGMENT_PATTERN.lastIndex = 0;
    while (SEGMENT_PATTERN.lastIndex < body.length) {
      const match = SEGMENT_PATTERN.exec(body);
      if (!match) {
        throw new WireChainDecodeError(
          `Invalid wire chain segment in "${body}"`
        );
      }
      const letter = match[1];
      const length = Number(match[2]);
      switch (letter) {
        case 'e':
          wires.push({
            pos: [x, y],
            direction: WireDirection.HORIZONTAL,
            length
          });
          x += length;
          break;
        case 'w':
          x -= length;
          wires.push({
            pos: [x, y],
            direction: WireDirection.HORIZONTAL,
            length
          });
          break;
        case 's':
          wires.push({
            pos: [x, y],
            direction: WireDirection.VERTICAL,
            length
          });
          y += length;
          break;
        case 'n':
          y -= length;
          wires.push({
            pos: [x, y],
            direction: WireDirection.VERTICAL,
            length
          });
          break;
      }
    }
  }

  return wires;
}
