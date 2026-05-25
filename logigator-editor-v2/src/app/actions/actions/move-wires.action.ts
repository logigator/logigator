import { Action } from '../action';
import type { Project } from '../../project/project';
import { MoveEntry } from './move-entry.model';

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
