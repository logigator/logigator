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

/** Walk directions, indexed as the letters are. */
const LETTERS = 'eswn';
const EAST = 0;
const SOUTH = 1;

const keyOf = (p: GridPoint): string => `${p[0]},${p[1]}`;

/** One completed walk, before the heads are delta-encoded against each other. */
interface Chunk {
  head: GridPoint;
  text: string;
  /** Input indices of the wires this walk consumed, in walk order. */
  wires: number[];
}

/**
 * Encodes wires as chain text.
 *
 * The traversal is what makes the text compress, and it is decided **locally
 * at every vertex** rather than by a walk wandering the graph. Each vertex
 * pairs up the wire ends that meet there — a pair is a place a walk passes
 * through — and the walks are then just the chains the pairs form:
 *
 * - **Straight first.** East pairs with west and north with south, so a run
 *   reads as one repeated letter (`e2e2e2`) and a bus runs through every tap
 *   on it. A T's stem is the end left over, so a walk arriving along the stem
 *   **ends at the bus** instead of turning into it and cutting it in two.
 * - **Then bends.** Whatever cannot pair straight pairs in canonical order —
 *   a corner's two wires, or overlapping collinear ones — until at most one end
 *   is left, which is where a walk ends.
 *
 * So every odd-degree vertex ends exactly one walk and no even one ends any,
 * which is the theoretical floor of `max(1, odd-degree vertices / 2)` walks per
 * connected component; only a closed loop the pairing leaves over costs a
 * chunk beyond it. The win over a greedy walk is not the count, though — it is
 * that alike structures serialize alike, which is what the compressor matches
 * on.
 *
 * A walk **starts at its port end** — the degree-1 one, where it has exactly
 * one. A walk with a port at both ends starts furthest south, then east; one
 * between two junctions furthest east, then south. Loops, having no
 * end, start at their north-westernmost vertex. Ignoring the port end
 * compresses markedly worse, whichever corner comes next.
 *
 * **Chunks are then emitted sorted by their head's (y, x)**, not in the order
 * the walks were formed — head deltas are measured against the previous
 * chunk's head, and a sorted sequence keeps them small and regular, with alike
 * structures side by side on a row. (Grouping chunks by walk text or by
 * connected component instead, or measuring each delta from the previous
 * walk's end point, all compress worse.)
 *
 * Linear apart from sorting each vertex's ends and the chunks. Deterministic
 * throughout, since a re-save of an untouched document has to produce
 * byte-identical text: every choice is made from geometry — a wire end is
 * identified by its point, direction and length — and chunks sharing a head
 * are ordered by their text, so the input's order never reaches the output.
 * `order` follows the **emission** order: `order[k]` is the input index of the
 * k-th wire in the text, which is what defines the body's wire order.
 */
export function encodeWireChain(
  wires: readonly SerializedWireBody[]
): EncodedWireChain {
  const count = wires.length;
  // Each wire has two ends: `2i` at its west/north endpoint, where a walk
  // leaves east or south, and `2i + 1` at the other, where it leaves west or
  // north. Canonical endpoints, so a negative length changes nothing.
  const lengths = new Array<number>(count);
  const points = new Array<GridPoint>(2 * count);
  for (let i = 0; i < count; i++) {
    const { pos, direction, length } = wires[i];
    const horizontal = direction === WireDirection.HORIZONTAL;
    const far: GridPoint = horizontal
      ? [pos[0] + length, pos[1]]
      : [pos[0], pos[1] + length];
    points[2 * i] = length < 0 ? far : pos;
    points[2 * i + 1] = length < 0 ? pos : far;
    lengths[i] = Math.abs(length);
  }
  const letterOf = (end: number): number =>
    (wires[end >> 1].direction === WireDirection.HORIZONTAL ? EAST : SOUTH) +
    (end & 1) * 2;

  // The ends meeting at each point.
  const vertices = new Map<string, number[]>();
  for (let end = 0; end < 2 * count; end++) {
    const key = keyOf(points[end]);
    const ends = vertices.get(key);
    if (ends) ends.push(end);
    else vertices.set(key, [end]);
  }
  const degreeAt = (end: number): number =>
    vertices.get(keyOf(points[end]))!.length;

  // `mate[end]` is the end a walk arriving at `end` leaves by, or -1 where it
  // stops.
  const mate = new Int32Array(2 * count).fill(-1);
  const pair = (a: number, b: number): void => {
    mate[a] = b;
    mate[b] = a;
  };
  for (const ends of vertices.values()) {
    // Letter, then length: at one point that names the wire, so the order is
    // canonical up to identical wires, which are interchangeable.
    ends.sort(
      (a, b) => letterOf(a) - letterOf(b) || lengths[a >> 1] - lengths[b >> 1]
    );
    if (ends.length < 2) continue;
    const byLetter: number[][] = [[], [], [], []];
    const bends: number[] = [];
    for (const end of ends) {
      // A zero-length wire has both ends here; pairing them straight would
      // join the wire to itself.
      if (lengths[end >> 1] === 0) bends.push(end);
      else byLetter[letterOf(end)].push(end);
    }
    for (const [a, b] of [
      [byLetter[0], byLetter[2]],
      [byLetter[1], byLetter[3]]
    ]) {
      const straight = Math.min(a.length, b.length);
      for (let k = 0; k < straight; k++) pair(a[k], b[k]);
      for (let k = straight; k < a.length; k++) bends.push(a[k]);
      for (let k = straight; k < b.length; k++) bends.push(b[k]);
    }
    bends.sort(
      (a, b) => letterOf(a) - letterOf(b) || lengths[a >> 1] - lengths[b >> 1]
    );
    for (let k = 0; k + 1 < bends.length; k += 2) pair(bends[k], bends[k + 1]);
  }

  const used = new Array<boolean>(count).fill(false);
  const chunks: Chunk[] = [];
  /** Walks out of `start` along the pairs until they run out, or back into a
   * wire already walked, which is how a loop closes. */
  const walkFrom = (start: number): void => {
    let text = '';
    const walked: number[] = [];
    for (let end = start; end !== -1 && !used[end >> 1];) {
      used[end >> 1] = true;
      walked.push(end >> 1);
      text += LETTERS[letterOf(end)] + lengths[end >> 1];
      end = mate[end ^ 1];
    }
    chunks.push({ head: points[start], text, wires: walked });
  };
  /** The unpaired end at the other side of the open walk out of `end`. */
  const farEnd = (end: number): number => {
    let at = end;
    while (mate[at ^ 1] !== -1) at = mate[at ^ 1];
    return at ^ 1;
  };

  // Open walks: every unpaired end is one end of exactly one.
  const done = new Array<boolean>(2 * count).fill(false);
  for (let end = 0; end < 2 * count; end++) {
    if (mate[end] !== -1 || done[end]) continue;
    const other = farEnd(end);
    done[end] = done[other] = true;
    const portHere = degreeAt(end) === 1;
    const portThere = degreeAt(other) === 1;
    const [p, q] = [points[end], points[other]];
    // A run between two junctions reads east-first, measured; anything with
    // a port at both ends south-first.
    const [major, minor] = portHere ? [1, 0] : [0, 1];
    const startThere =
      portHere !== portThere
        ? portThere
        : q[major] > p[major] || (q[major] === p[major] && q[minor] > p[minor]);
    walkFrom(startThere ? other : end);
  }
  // Closed loops: whatever the open walks left, from the north-westernmost
  // point first, so where a loop starts is canonical.
  if (used.includes(false)) {
    const byPoint = [...vertices.values()].sort((a, b) => {
      const [p, q] = [points[a[0]], points[b[0]]];
      return p[1] - q[1] || p[0] - q[0];
    });
    for (const ends of byPoint) {
      for (const end of ends) if (!used[end >> 1]) walkFrom(end);
    }
  }

  chunks.sort(
    (a, b) =>
      a.head[1] - b.head[1] ||
      a.head[0] - b.head[0] ||
      (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)
  );

  const order: number[] = [];
  let prevHead: GridPoint = [0, 0];
  const text = chunks
    .map((chunk) => {
      for (const i of chunk.wires) order.push(i);
      const head = `${chunk.head[0] - prevHead[0]},${chunk.head[1] - prevHead[1]}`;
      prevHead = chunk.head;
      return `${head}:${chunk.text}`;
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
