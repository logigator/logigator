import { SerializedAction } from '../../actions/serialized-action.model';

/**
 * The dump envelope's own version; the native circuit body inside `project`
 * carries an independent file version.
 */
export const PROJECT_DUMP_VERSION = 1;

/**
 * Debug-only "Project Dump": a circuit plus everything needed to reconstruct
 * the in-memory session it came from. Generated and re-imported from the debug
 * menu, never by normal save or export.
 *
 * `project` is a normal native circuit-file document. That format drops element
 * ids on load, so `componentIds`/`wireIds` carry the originals for re-stamping,
 * which keeps the id-referencing `actions` valid. They run parallel to the
 * body's order — the encoders' emission order, which the decoders reproduce.
 */
export interface ProjectDump {
  dumpVersion: number;
  name: string;
  /** A native circuit-file document (same shape as a `.json` export). */
  project: unknown;
  /** Original component ids, parallel to `project`'s component order. */
  componentIds: number[];
  /** Original wire ids, parallel to `project`'s wire order. */
  wireIds: number[];
  /** The undo history to restore, with the redo pointer's position. */
  actions: { history: SerializedAction[]; pointer: number };
}
