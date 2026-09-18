import { SerializedCircuitBody } from './serialized-circuit';

/**
 * A session definition of a custom component — enough to render and place a
 * black-box instance. Every definition is one of two kinds:
 *
 * - a master: the mutable library entry, owning the persistent {@link id}, that
 *   the user places from and edits.
 * - a snapshot: a frozen copy embedded in a host project at place time,
 *   carrying provenance ({@link id} + {@link version}) back to its master.
 *
 * A placed instance always wraps a snapshot, so editing a master never changes
 * already-placed instances. Only masters are mutated in place; bringing an
 * instance up to date replaces its snapshot with a new one.
 */
export interface CustomComponentDefinition {
  /** Session-local numeric type id — the value written as `t` in the body. */
  readonly typeId: number;
  /** `master` = editable catalog entry; `snapshot` = frozen placed copy. */
  kind: 'master' | 'snapshot';
  /** Which library the {@link id} belongs to. */
  source: 'server' | 'browser';
  /**
   * Persistent identity, never conflated with {@link typeId}. A master's own
   * id; for a snapshot, the master it was copied from. Reverse `id → typeId` is
   * masters-only: one id maps to many snapshot type ids.
   */
  id?: string;
  /** A master's monotonic version; a snapshot's, the one it was taken at. */
  version?: number;
  /**
   * Masters only: epoch-ms of the last save, normalised across libraries (the
   * server sends an ISO string), used to order the palette newest-first.
   */
  lastEdited?: number;
  name: string;
  symbol: string;
  description: string;
  /** Derived from INPUT plug count. */
  numInputs: number;
  /** Derived from OUTPUT plug count. */
  numOutputs: number;
  /** Port labels, inputs first then outputs, in plug-index order. */
  labels: string[];
  /**
   * Server masters only: the share-link token, captured when the master is
   * registered so the share dialog reads it without an extra fetch.
   */
  link?: string;
  /** Server masters only: whether the component is published publicly. */
  isPublic?: boolean;
  /**
   * The definition's own circuit in the native body encoding, holding session
   * type ids. A snapshot's travels embedded with the host document; a master's
   * is materialised from its open project.
   */
  circuit?: SerializedCircuitBody;
}

/**
 * A master's user-authored descriptive metadata. It travels in placed
 * snapshots, so persisting an edit bumps the master's `version` like a circuit
 * save does and instances frozen at the older version are offered an update.
 */
export interface CustomComponentDetails {
  name: string;
  symbol: string;
  description: string;
}

/**
 * The patch applied when a master's plugs change. Port counts and labels are
 * always recomputed together; the descriptive fields are set only when the
 * create/edit dialog changes them.
 */
export interface CustomComponentSummaryPatch {
  numInputs: number;
  numOutputs: number;
  labels: string[];
  symbol?: string;
  name?: string;
  description?: string;
}
