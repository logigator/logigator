import { Action } from './action';
import { Project } from '../project/project';

export class ActionManager {
	private _history: Action[] = [];
	private _pointer: number = 0;

	constructor(private readonly project: Project) {}

	public push(action: Action): void {
		this._history.splice(this._pointer, Infinity, action);
		this._pointer = this._history.length;
	}

	public undo(): void {
		if (!this.undoAvailable) return;

		const action = this._history[--this._pointer];
		action.undo(this.project);
	}

	public redo(): void {
		if (!this.redoAvailable) return;

		const action = this._history[this._pointer++];
		action.do(this.project);
	}

	public clear(): void {
		this._history = [];
		this._pointer = 0;
	}

	public get undoAvailable(): boolean {
		return this._pointer > 0;
	}

	public get redoAvailable(): boolean {
		return this._pointer < this._history.length;
	}
}
