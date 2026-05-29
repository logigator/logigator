import { Subject, Observable } from 'rxjs';
import { Action } from './action';
import { Project } from '../project/project';

export class ActionManager {
	private _history: Action[] = [];
	private _pointer = 0;

	private readonly _actionChange$ = new Subject<void>();
	public readonly actionChange$: Observable<void> =
		this._actionChange$.asObservable();

	constructor(private readonly project: Project) {}

	public push(action: Action): void {
		this._history.splice(this._pointer, Infinity, action);
		this._pointer = this._history.length;
		action.do(this.project);
		this._actionChange$.next();
	}

	// Records an action without calling action.do() — for cases where the
	// project has already been mutated to the action's post-state and rerunning
	// do() would double-apply (e.g., a SELECT_EXACT scissor cut is already
	// materialized in the quad-tree; SelectionMoveSession folds it into its
	// move container at commit time, and the move mutations are also already
	// applied). The action stays in the history so undo / redo work normally.
	public register(action: Action): void {
		this._history.splice(this._pointer, Infinity, action);
		this._pointer = this._history.length;
		this._actionChange$.next();
	}

	public undo(): void {
		// A pending scissor-select cut is project state that lives outside the
		// undo history. Reverting it counts as the user's "undo this last
		// visible change" intent, so consume the keystroke here before the
		// real history pointer moves. Lazy `this.project.selectionManager`
		// access matters — Project constructs actionManager (this) before
		// selectionManager, so reading it at construction time would NPE.
		if (this.project.selectionManager.rollbackPendingCut()) return;

		if (!this.undoAvailable) return;

		const action = this._history[--this._pointer];
		action.undo(this.project);
		this._actionChange$.next();
	}

	public redo(): void {
		if (!this.redoAvailable) return;

		const action = this._history[this._pointer++];
		action.do(this.project);
		this._actionChange$.next();
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
