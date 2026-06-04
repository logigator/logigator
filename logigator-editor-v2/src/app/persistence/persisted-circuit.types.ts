/**
 * Version bases for the persisted-circuit type hierarchy. A "persisted circuit"
 * is the version-specific payload shape shared by every transport that carries
 * it; concrete transport envelopes (the local file, the legacy server wire) add
 * their own framing on top and live in their target folder (`file/`, `server/`).
 *
 * Two axes of versioning meet in this layer — keep them distinct:
 * - **File-format version** (this hierarchy: V0, V1, `CURRENT_FILE_VERSION`).
 * - **Custom-component master / snapshot version**
 *   ({@link SnapshotDefinition.source}'s `version`) — a per-master content
 *   revision counter, unrelated to the format version.
 */
import { ProjectElement } from '../api/models/project-element';
import {
	SerializedComponentBody,
	SerializedWireBody,
	SnapshotDefinition
} from './serialized-circuit';

// ---- V0: legacy positional format ("v0 of the file format", also today's
//          server wire shape). Components and wires are intermixed in one
//          positional `ProjectElement[]` array. ----

/** One v0 element — a component instance or a wire — in the positional encoding. */
export type PersistedComponentV0 = ProjectElement;

/**
 * The v0 circuit: an intermixed array of positional elements. Each envelope
 * places this array where its wire shape dictates — at the top level for the
 * server transport, nested under `project` for the legacy file — so `elements`
 * is optional on the base.
 */
export interface PersistedCircuitV0 {
	elements?: PersistedComponentV0[];
}

// ---- V1: native current format. Named options, components and wires split. ----

/** One placed component in the native body (type id, position, named options). */
export type PersistedComponentV1 = SerializedComponentBody;

/** One wire in the native body (start position, direction, length). */
export type PersistedWireV1 = SerializedWireBody;

/**
 * The v1 transport payload: the native circuit body plus the frozen snapshots
 * of every custom it transitively uses. Shared verbatim by the file and browser
 * targets — the explicit contract behind "the browser store reuses the file
 * format".
 */
export interface PersistedCircuitV1 {
	components: PersistedComponentV1[];
	wires: PersistedWireV1[];
	definitions: SnapshotDefinition[];
}
