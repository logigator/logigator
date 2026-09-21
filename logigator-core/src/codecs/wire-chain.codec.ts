import { SerializedWireBody } from '../model/serialized-circuit';
import { WireDirection } from '../model/wire-direction.enum';

/**
 * Chain codec for the persisted wire encoding: SVG-path-style walks over the
 * wire graph, `"x,y:e5s3;x,y:n2"`. Each chunk starts at a point; every segment
 * is one wire leaving the current point (`e`/`s`/`w`/`n` + length, no separator
 * needed since the next letter ends the number), and its far endpoint starts
 * the next segment. Chunk heads are deltas against the previous head, the first
 * against the origin, and chunks are emitted in (y, x) order of their head — so
 * nearby chunks open with small repeating deltas rather than high-entropy
 * absolutes. That is half of where the compressed size win comes from; the
 * other half is the walk that produced the chunks, described on
 * {@link encodeWireChain}.
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

/** A point of the wire graph and the wires incident to it, in canonical order.
 * A zero-length wire is incident twice, so its point's degree stays 2. */
interface Vertex {
  point: GridPoint;
  wires: number[];
}

/** One completed walk, before the heads are delta-encoded against each other. */
interface Chunk {
  head: GridPoint;
  segments: string[];
  /** Input indices of the wires this walk consumed, in walk order. */
  wires: number[];
}

/**
 * Encodes wires as chain text.
 *
 * The traversal is what makes the text compress. A walk starts at a **degree-1
 * vertex** wherever one is left — the end of an open run, so one chunk covers
 * the whole run rather than starting mid-run and dead-ending after a segment —
 * and at a junction it **continues straight** before it turns, so a straight
 * run reads as one repeated letter (`e2e2e2`) instead of an arbitrary zig-zag
 * through it. Together they make alike structures serialize alike, which is
 * what the compressor matches on. The win is not fewer chunks: the walk is
 * already at the theoretical floor of `max(1, odd-degree vertices / 2)` trails
 * per connected component (254,848 chunks against a floor of 254,707 over the
 * largest 100 corpus documents). It is more repetitive text.
 *
 * Walks are formed in two passes over the vertices in (y, x) order: degree-1
 * vertices first, then every vertex, since a cycle has no degree-1 vertex and
 * would otherwise never be walked at all. Each vertex is **drained** rather
 * than walked once — a single walk leaves by one wire and can get stuck
 * elsewhere, so an odd-degree vertex is left holding wires no later vertex
 * would come back for. Overlapping collinear wires are what make that
 * reachable in practice; they violate the editor's wire invariants, but an
 * unrepaired board must not lose wires by being saved.
 *
 * **Chunks are then emitted sorted by their head's (y, x)**, not in the order
 * the walks were formed — head deltas are measured against the previous
 * chunk's head, and a sorted sequence keeps them small and regular. (Grouping
 * chunks by walk text instead measured 0.912×, and measuring each delta from
 * the previous walk's end point 0.858×.)
 *
 * Deterministic throughout, since a re-save of an untouched document has to
 * produce byte-identical text: every tie — which vertex starts a walk, which
 * of two equally straight wires it takes, which chunk is emitted first —
 * breaks by (y, x) and then by the wire's own shape, so the input's order
 * never reaches the output. `order` follows the **emission** order rather than
 * the walk order: `order[k]` is the input index of the k-th wire in the text,
 * which is what defines the body's wire order.
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
  // Wires in canonical order: start point, then the wire's own shape, so two
  // inputs holding the same wires in a different order encode identically.
  const sorted = wires
    .map((_, i) => i)
    .sort((u, v) => {
      const a = startOf(u);
      const b = startOf(v);
      return (
        a[1] - b[1] ||
        a[0] - b[0] ||
        wires[u].direction - wires[v].direction ||
        Math.abs(wires[u].length) - Math.abs(wires[v].length) ||
        u - v
      );
    });

  // Incident lists inherit that canonical order, so "the first unused wire
  // here" is a canonical choice rather than an input-order one.
  const vertices = new Map<string, Vertex>();
  for (const i of sorted) {
    for (const p of ends[i]) {
      const key = keyOf(p);
      const vertex = vertices.get(key);
      if (vertex) vertex.wires.push(i);
      else vertices.set(key, { point: p, wires: [i] });
    }
  }
  const points = [...vertices.values()].sort(
    (a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]
  );

  const used = new Array<boolean>(wires.length).fill(false);
  const chunks: Chunk[] = [];

  /** Walking `index` from `cur`: its letter, its length and where it lands.
   * The letter comes from the wire's own direction and the sign of the delta,
   * never from comparing the two points — a zero-length wire has to stay
   * `e`/`s` per its direction for the decode to give the wire back. */
  const stepFrom = (
    cur: GridPoint,
    index: number
  ): [string, number, GridPoint] => {
    const [a, b] = ends[index];
    const other = a[0] === cur[0] && a[1] === cur[1] ? b : a;
    const horizontal = wires[index].direction === WireDirection.HORIZONTAL;
    const delta = horizontal ? other[0] - cur[0] : other[1] - cur[1];
    const letter = horizontal ? (delta < 0 ? 'w' : 'e') : delta < 0 ? 'n' : 's';
    return [letter, Math.abs(delta), other];
  };

  /** Walks one chunk out of `vertex`, or reports that none was left there. */
  const walkFrom = (vertex: Vertex): boolean => {
    let cur = vertex.point;
    let last: string | null = null;
    const segments: string[] = [];
    const walked: number[] = [];
    for (;;) {
      const incident = vertices.get(keyOf(cur))?.wires ?? [];
      let pick = -1;
      let step: [string, number, GridPoint] | null = null;
      for (const i of incident) {
        if (used[i]) continue;
        const candidate = stepFrom(cur, i);
        // The first unused wire in canonical order, unless a later one
        // carries the walk straight on.
        if (pick === -1) {
          pick = i;
          step = candidate;
        }
        if (candidate[0] === last) {
          pick = i;
          step = candidate;
          break;
        }
      }
      if (step === null) break;
      used[pick] = true;
      walked.push(pick);
      segments.push(step[0] + step[1]);
      last = step[0];
      cur = step[2];
    }
    if (segments.length === 0) return false;
    chunks.push({ head: vertex.point, segments, wires: walked });
    return true;
  };

  /** Walks `vertex` until nothing unused is left there. One walk is not
   * enough: it leaves by one wire and can get stuck elsewhere, so a vertex of
   * odd degree keeps wires the walk never came back for — and the sweep below
   * passes each vertex once. Walks only ever consume, so a drained vertex
   * stays drained, and every wire is taken at whichever of its two endpoints
   * the sweep reaches first. */
  const drain = (vertex: Vertex): void => {
    while (walkFrom(vertex)) {
      // Another chunk started here; keep going until none does.
    }
  };

  // Open runs first, from the end rather than the middle.
  for (const vertex of points) {
    if (vertex.wires.length === 1) drain(vertex);
  }
  // Then every vertex, which is what covers a run whose ends were consumed and
  // a cycle, having no degree-1 vertex to have been started from.
  for (const vertex of points) drain(vertex);

  // Stable, so the chunks a drained vertex produced keep the order it walked
  // them in — they share a head and cannot be told apart by it.
  chunks.sort((a, b) => a.head[1] - b.head[1] || a.head[0] - b.head[0]);

  const order: number[] = [];
  let prevHead: GridPoint = [0, 0];
  const text = chunks
    .map((chunk) => {
      for (const i of chunk.wires) order.push(i);
      const head = `${chunk.head[0] - prevHead[0]},${chunk.head[1] - prevHead[1]}`;
      prevHead = chunk.head;
      return `${head}:${chunk.segments.join('')}`;
    })
    .join(';');

  return { text, order };
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
