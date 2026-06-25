import { Observable, Subject } from 'rxjs';
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

  /** The recorded actions, oldest first. Read-only view for the debug dump. */
  public get history(): readonly Action[] {
    return this._history;
  }

  /** Index of the next redo (== number of done actions). For the debug dump. */
  public get pointer(): number {
    return this._pointer;
  }

  /**
   * Replaces the history and pointer wholesale **without** re-applying any
   * action — the project is expected to already hold the matching post-`do`
   * state (debug Project Dump import loads the circuit body first, then restores
   * this stack so undo/redo walks the real session history). The pointer is
   * clamped into range.
   */
  public restore(history: Action[], pointer: number): void {
    this._history = [...history];
    this._pointer = Math.max(0, Math.min(pointer, this._history.length));
    this._actionChange$.next();
  }

  public get undoAvailable(): boolean {
    return this._pointer > 0;
  }

  public get redoAvailable(): boolean {
    return this._pointer < this._history.length;
  }

  /**
   * Completes {@link actionChange$} so subscribers (dirty tracking, a
   * `DefinitionBinding`) release without an explicit unsubscribe. Called from
   * `Project.destroy`; the manager is single-use afterwards.
   */
  public destroy(): void {
    this._actionChange$.complete();
  }
}
