import { Project } from '../project/project';
import { SerializedAction } from './serialized-action.model';

export abstract class Action {
  abstract do(project: Project): void;
  abstract undo(project: Project): void;

  /**
   * JSON-safe snapshot of this action, used by the debug Project Dump feature
   * to persist and restore the undo history. Reconstruct via `deserializeAction`
   * (see `action-codec.ts`).
   */
  abstract serialize(): SerializedAction;
}
