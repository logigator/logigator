import { Project } from '../project/project';
import { SerializedAction } from './serialized-action.model';

export abstract class Action {
  abstract do(project: Project): void;
  abstract undo(project: Project): void;

  /** JSON-safe snapshot; reconstruct with `deserializeAction`. */
  abstract serialize(): SerializedAction;
}
