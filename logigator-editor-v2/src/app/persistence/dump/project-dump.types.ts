import { SerializedAction } from '../../actions/serialized-action.model';

/** Bumped if the dump envelope shape changes; the native circuit body inside
 * `project` carries its own independent file version. */
export const PROJECT_DUMP_VERSION = 1;

/**
 * Debug-only "Project Dump": a circuit plus everything needed to reconstruct the
 * exact in-memory session it came from. Generated and re-imported from the debug
 * menu; never produced by normal save/export.
 *
 * `project` is a normal native circuit-file document — it loads just like a file
 * import. Because that format drops element ids on load, `componentIds`/`wireIds`
 * carry the original ids (parallel to the body's component/wire order) so they
 * can be re-stamped, which keeps the id-referencing `actions` valid.
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
