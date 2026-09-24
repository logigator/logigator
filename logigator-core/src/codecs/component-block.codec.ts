import { builtInMeta } from '../catalog/built-in-meta';
import { ComponentMeta } from '../catalog/component-meta';
import { defaultOptionValues } from '../catalog/option-schema';
import { ComponentType } from '../model/component-type.enum';
import {
  PersistedComponentBlockV2,
  PersistedNegationColumnV2
} from '../model/persisted-circuit.types';
import { SerializedComponentBody } from '../model/serialized-circuit';

/**
 * Column codec for persisted components: the v2 encoding, one block per type
 * with parallel columns inside it.
 *
 * Components are emitted sorted by (type, direction, y, x), so every type is
 * one contiguous run whose header carries `type` once and whose `dir` column
 * falls into runs. `x` and `y` are delta columns reset per block — the first
 * value absolute, the rest relative to the previous entry — which keeps a block
 * independent of the ones before it while costing one absolute value each.
 * Absolute coordinates are the high-entropy part gzip cannot remove; the deltas
 * a (y, x) walk produces repeat and compress away.
 *
 * As with the wire chain, encoding defines the document's component order, so
 * per-component data is aligned through the returned emission order.
 *
 * `position-delta.codec.ts` is v1's shape and stays frozen beside this one.
 */

/** A decode failure: a structurally invalid persisted component block. */
export class ComponentBlockDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentBlockDecodeError';
  }
}

/**
 * A built-in's meta by type id, or `undefined` for a custom or unknown one —
 * the same lookup a migration context carries, so a migration can hand over the
 * catalog it was given rather than reaching for the global one.
 */
export type ComponentCatalogLookup = (
  type: ComponentType
) => ComponentMeta | undefined;

export interface EncodedComponentBlocks {
  blocks: PersistedComponentBlockV2[];
  /** `order[k]` = index into the input array of the k-th emitted component. */
  order: number[];
}

/**
 * Sorts by (type, direction, y, x), groups into per-type blocks and writes each
 * one's columns. Input is not mutated.
 *
 * The sort is a pure encoder choice — decoding is a prefix sum, and the
 * document's order *is* the decoded order — but it is total: the input index
 * breaks the ties real boards contain (two components at one position), so a
 * re-save of an untouched document produces byte-identical columns rather than
 * churning the stored row.
 *
 * `catalog` names the option schemas the columns are written from; it defaults
 * to the built-in catalog, which is what every writer outside a migration uses.
 */
export function encodeComponentBlocks(
  components: readonly SerializedComponentBody[],
  catalog: ComponentCatalogLookup = builtInMeta
): EncodedComponentBlocks {
  const order = components
    .map((_, i) => i)
    .sort((u, v) => {
      const a = components[u];
      const b = components[v];
      return (
        a.type - b.type ||
        (a.direction ?? 0) - (b.direction ?? 0) ||
        a.pos[1] - b.pos[1] ||
        a.pos[0] - b.pos[0] ||
        u - v
      );
    });

  const blocks: PersistedComponentBlockV2[] = [];
  for (let start = 0; start < order.length;) {
    const type = components[order[start]].type;
    let end = start + 1;
    while (end < order.length && components[order[end]].type === type) end++;
    const items: SerializedComponentBody[] = [];
    for (let i = start; i < end; i++) items.push(components[order[i]]);
    blocks.push(encodeBlock(type, items, catalog));
    start = end;
  }

  return { blocks, order };
}

function encodeBlock(
  type: number,
  items: readonly SerializedComponentBody[],
  catalog: ComponentCatalogLookup
): PersistedComponentBlockV2 {
  const x: number[] = [];
  const y: number[] = [];
  let px = 0;
  let py = 0;
  for (const c of items) {
    x.push(c.pos[0] - px);
    y.push(c.pos[1] - py);
    [px, py] = c.pos;
  }

  const block: PersistedComponentBlockV2 = { type, x, y };
  // An all-East block is the common one, and its column would be a run of
  // zeroes saying nothing.
  if (items.some((c) => c.direction)) {
    block.dir = items.map((c) => c.direction ?? 0);
  }
  const opt = encodeOptionColumns(type, items, catalog);
  if (opt) block.opt = opt;
  const negIn = encodeNegationColumn(items, 'negInputs');
  if (negIn) block.negIn = negIn;
  const negOut = encodeNegationColumn(items, 'negOutputs');
  if (negOut) block.negOut = negOut;
  return block;
}

/**
 * One total column per option the type's schema declares: a component that
 * omitted a key takes the schema default, and a key the catalog does not have
 * is dropped. A type with no meta — a custom, which carries no options, or an
 * unknown built-in, which the catalog step drops anyway — emits nothing.
 */
function encodeOptionColumns(
  type: number,
  items: readonly SerializedComponentBody[],
  catalog: ComponentCatalogLookup
): Record<string, unknown[]> | undefined {
  const meta = catalog(type);
  if (!meta) return undefined;
  const defaults = defaultOptionValues(meta.options);
  const keys = Object.keys(defaults);
  if (!keys.length) return undefined;

  const opt: Record<string, unknown[]> = {};
  for (const key of keys) {
    opt[key] = items.map((c) =>
      c.options && key in c.options ? c.options[key] : defaults[key]
    );
  }
  return opt;
}

/**
 * The block's negated ports as index deltas plus payloads, the first delta
 * being the index plus one. `undefined` when nothing in the block is negated,
 * so a board that never used the feature pays nothing for it.
 *
 * A field that is not an array is dropped rather than written: older documents
 * carry junk there, and the format has always sanitized negation element-wise
 * on read rather than rejecting the document over it.
 */
function encodeNegationColumn(
  items: readonly SerializedComponentBody[],
  field: 'negInputs' | 'negOutputs'
): PersistedNegationColumnV2 | undefined {
  const deltas: number[] = [];
  const ports: number[][] = [];
  let previous = -1;
  items.forEach((c, index) => {
    const negated = c[field];
    if (!Array.isArray(negated) || !negated.length) return;
    deltas.push(index - previous);
    previous = index;
    ports.push([...negated]);
  });
  return deltas.length ? [deltas, ports] : undefined;
}

/**
 * Restores absolute positions and per-component fields from the block columns,
 * in document order: blocks in order, each block's entries in order.
 *
 * Throws {@link ComponentBlockDecodeError} when a block is not readable —
 * every entry feeds the running position, so a broken one would poison
 * everything after it. Option columns are read as far as they go: a column the
 * document never carried leaves the key absent, and the catalog step fills it
 * with the schema default, which is what keeps a document written before a new
 * option was added readable.
 */
export function decodeComponentBlocks(
  blocks: readonly PersistedComponentBlockV2[]
): SerializedComponentBody[] {
  const components: SerializedComponentBody[] = [];

  for (const block of blocks) {
    if (!block || !Array.isArray(block.x) || !Array.isArray(block.y)) {
      throw new ComponentBlockDecodeError('Invalid component block in file');
    }
    const length = block.x.length;
    const negIn = decodeNegationColumn(block.negIn, length);
    const negOut = decodeNegationColumn(block.negOut, length);

    let px = 0;
    let py = 0;
    for (let i = 0; i < length; i++) {
      const dx = block.x[i];
      const dy = block.y[i];
      if (typeof dx !== 'number' || typeof dy !== 'number') {
        throw new ComponentBlockDecodeError('Invalid component block in file');
      }
      px += dx;
      py += dy;

      const direction = block.dir?.[i] ?? 0;
      const negInputs = negIn.get(i);
      const negOutputs = negOut.get(i);
      components.push({
        type: block.type,
        pos: [px, py],
        ...(direction ? { direction } : {}),
        options: decodeOptionsAt(block.opt, i),
        ...(negInputs ? { negInputs } : {}),
        ...(negOutputs ? { negOutputs } : {})
      });
    }
  }

  return components;
}

function decodeOptionsAt(
  opt: Record<string, unknown[]> | undefined,
  index: number
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (!opt) return options;
  for (const [key, column] of Object.entries(opt)) {
    if (Array.isArray(column) && index < column.length) {
      options[key] = column[index];
    }
  }
  return options;
}

/** Index → ports, from the delta column. */
function decodeNegationColumn(
  column: PersistedNegationColumnV2 | undefined,
  length: number
): Map<number, number[]> {
  const negated = new Map<number, number[]>();
  if (column === undefined) return negated;
  if (!Array.isArray(column) || !Array.isArray(column[0])) {
    throw new ComponentBlockDecodeError('Invalid negation column in file');
  }

  const [deltas, ports] = column;
  let index = -1;
  for (let k = 0; k < deltas.length; k++) {
    const delta = deltas[k];
    if (typeof delta !== 'number') {
      throw new ComponentBlockDecodeError('Invalid negation column in file');
    }
    index += delta;
    if (index < 0 || index >= length) {
      throw new ComponentBlockDecodeError(
        'Negation index outside its component block'
      );
    }
    const entry = Array.isArray(ports) ? ports[k] : undefined;
    if (Array.isArray(entry) && entry.length) negated.set(index, [...entry]);
  }
  return negated;
}
