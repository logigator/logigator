/**
 * Version bases for the persisted-circuit hierarchy: the version-specific
 * payload shape every transport shares, with envelopes adding their own
 * framing.
 *
 * Two versioning axes meet here and stay distinct: the format version (V0, V1,
 * `CURRENT_FILE_VERSION`) and a custom-component master's content revision
 * counter ({@link SnapshotDefinition.source}'s `version`).
 */
import { ProjectElement } from './project-element';
import {
  SerializedComponentBody,
  SnapshotDefinition
} from './serialized-circuit';

// ---- V0: positional format, read-only. Components and wires intermixed in
//          one `ProjectElement[]` array. ----

/** One v0 element — a component instance or a wire — in the positional encoding. */
export type PersistedComponentV0 = ProjectElement;

/**
 * The v0 circuit: an intermixed array of positional elements. Envelopes place
 * the array differently (top level, or nested under `project`), so `elements`
 * is optional on the base.
 */
export interface PersistedCircuitV0 {
  elements?: PersistedComponentV0[];
}

// ---- V1: named options, components and wires split. ----

/**
 * One placed component in the native body. Persisted `pos` is delta-encoded:
 * components are stored sorted by (type, y, x), each position relative to the
 * previous component's absolute position. The decoded order is the body's.
 */
export type PersistedComponentV1 = SerializedComponentBody;

/**
 * A circuit's wires as chain text (`"x,y:e5s3;x,y:n2"`): SVG-path-style walks
 * over the wire graph, one segment per wire, chunk heads relative to the
 * previous chunk's head. The decoded order is the body's wire order.
 */
export type PersistedWiresV1 = string;

/** A {@link SnapshotDefinition} as persisted: components delta-encoded, wires
 * chain-encoded. */
export type PersistedSnapshotDefinitionV1 = Omit<
  SnapshotDefinition,
  'wires'
> & {
  wires: PersistedWiresV1;
};

/**
 * The v1 payload: the native circuit body plus frozen snapshots of every custom
 * it transitively uses. Shared verbatim by every target.
 */
export interface PersistedCircuitV1 {
  components: PersistedComponentV1[];
  wires: PersistedWiresV1;
  definitions: PersistedSnapshotDefinitionV1[];
}

// ---- V2: current format. Components as per-type column blocks. ----

/**
 * One block of the v2 component encoding: every component of one type, as
 * parallel columns.
 *
 * Components are emitted sorted by (type, direction, y, x), so every type is
 * one contiguous run and the block header carries `type` once. `x` and `y` are
 * delta columns **reset per block** — the first value absolute, the rest
 * relative to the previous entry — which keeps a block independent of the ones
 * before it. Absolute coordinates are the high-entropy part gzip cannot remove;
 * deltas, and the runs of identical deltas the sort produces, compress away.
 *
 * `x.length` is the block's length and every other column matches it — that is
 * the whole structural invariant. Which keys a block carries is not one: a
 * built-in that gains an option later leaves older documents without that
 * column, and the catalog step fills it with the schema default on read.
 */
export interface PersistedComponentBlockV2 {
  /** Session type id in an in-memory circuit; file-local in a persisted
   * {@link SnapshotDefinition}. */
  type: number;
  /** Delta-encoded x coordinates; the first is absolute. */
  x: number[];
  /** Delta-encoded y coordinates; the first is absolute. */
  y: number[];
  /** Quarter-turns clockwise from East, 0–3. Omitted when the block is all East. */
  dir?: number[];
  /**
   * One total column per option the type's catalog schema declares: every
   * component of the block has a value, a document that omitted one carrying
   * the schema default. A type with no meta emits no `opt` at all.
   */
  opt?: Record<string, unknown[]>;
  /** Negated input ports; see {@link PersistedNegationColumnV2}. */
  negIn?: PersistedNegationColumnV2;
  /** Negated output ports; see {@link PersistedNegationColumnV2}. */
  negOut?: PersistedNegationColumnV2;
}

/**
 * The negated ports of a block, as two parallel columns: the index **deltas**
 * of the components that have one — the first being the index plus one, so a
 * negated first component reads `1` — and their port arrays. Absent entirely
 * when a block has none.
 *
 * Delta-indexed rather than absolute index-tagged pairs: a run of
 * monotonically increasing indices is incompressible entropy, and measured
 * four times larger where negations are common.
 */
export type PersistedNegationColumnV2 = [
  indexDeltas: number[],
  ports: number[][]
];

/** A circuit's wires as chain text — unchanged from v1. */
export type PersistedWiresV2 = PersistedWiresV1;

/** A {@link SnapshotDefinition} as persisted: components in per-type blocks,
 * wires chain-encoded. */
export type PersistedSnapshotDefinitionV2 = Omit<
  SnapshotDefinition,
  'components' | 'wires'
> & {
  components: PersistedComponentBlockV2[];
  wires: PersistedWiresV2;
};

/**
 * The v2 payload: the native circuit body plus frozen snapshots of every custom
 * it transitively uses. Shared verbatim by every target.
 */
export interface PersistedCircuitV2 {
  components: PersistedComponentBlockV2[];
  wires: PersistedWiresV2;
  definitions: PersistedSnapshotDefinitionV2[];
}
