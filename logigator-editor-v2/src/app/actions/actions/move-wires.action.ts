import { Action } from '../action';
import type { Project } from '../../project/project';
import { MoveEntry, serializeMoveEntries } from './move-entry.model';
import { SerializedAction } from '../serialized-action.model';

export class MoveWiresAction extends Action {
  private readonly _entries: MoveEntry[];

  constructor(...entries: MoveEntry[]) {
    super();
    this._entries = entries.map((e) => ({
      id: e.id,
      oldPos: e.oldPos.clone(),
      newPos: e.newPos.clone()
    }));
  }

  serialize(): SerializedAction {
    return { type: 'moveWires', entries: serializeMoveEntries(this._entries) };
  }

  do(project: Project): void {
    for (const e of this._entries) {
      project.moveWire(e.id, e.newPos);
    }
  }

  undo(project: Project): void {
    for (const e of this._entries) {
      project.moveWire(e.id, e.oldPos);
    }
  }
}
