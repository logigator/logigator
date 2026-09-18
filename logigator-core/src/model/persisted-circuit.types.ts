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

// ---- V1: current format. Named options, components and wires split. ----

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
