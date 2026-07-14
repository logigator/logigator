import { Observable, Subject } from 'rxjs';
import { Action } from './action';
import { Project } from '../project/project';
import { LoggingService } from '../logging/logging.service';
import { getStaticDI } from '../utils/get-di';

/**
 * Undo/redo history. Two commit styles, one convention:
 *
 * - {@link push} records the action AND runs its `do()` — for instantaneous,
 *   non-gesture operations (wire-tap toggles, option panels) that build fresh
 *   actions against the current state.
 * - {@link register} records the action WITHOUT running `do()` — for drag
 *   sessions, which always materialize their final state in the live project
 *   during the gesture and then record it. Re-running `do()` would
 *   double-apply (and re-deserialize instances whose ids are already in the
 *   tree).
 */
export class ActionManager {
  private _history: Action[] = [];
  private _pointer = 0;

  private readonly logging = getStaticDI(LoggingService);

  private readonly _actionChange$ = new Subject<void>();
  public readonly actionChange$: Observable<void> =
    this._actionChange$.asObservable();

  // While a drag session is live (set by the WorkModeRouter), undo/redo are
  // inert: the session may hold elements detached from the quad tree, and a
  // history operation touching them would corrupt the tree (duplicate ids,
  // dangling instances). Commits are unaffected — a session registers its
  // action before the router unlocks.
  public locked = false;

  constructor(private readonly project: Project) {}

  public push(action: Action): void {
    this._history.splice(this._pointer, Infinity, action);
    this._pointer = this._history.length;
    action.do(this.project);
    this.logging.debug(
      `push ${action.constructor.name} → pointer ${this._pointer}, history ${this._history.length}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  public register(action: Action): void {
    this._history.splice(this._pointer, Infinity, action);
    this._pointer = this._history.length;
    this.logging.debug(
      `register ${action.constructor.name} without do() → pointer ${this._pointer}, history ${this._history.length}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  public undo(): void {
    if (this.locked) {
      this.logging.debug('undo ignored: a drag session is live', 'ActionManager');
      return;
    }

    // A pending scissor-select cut is project state that lives outside the
    // undo history. Reverting it counts as the user's "undo this last
    // visible change" intent, so consume the keystroke here before the
    // real history pointer moves. Lazy `this.project.selectionManager`
    // access matters — Project constructs actionManager (this) before
    // selectionManager, so reading it at construction time would NPE.
    if (this.project.selectionManager.rollbackPendingCut()) {
      this.logging.debug(
        'undo consumed by pending scissor-cut rollback; pointer unchanged',
        'ActionManager'
      );
      return;
    }

    if (!this.undoAvailable) return;

    const action = this._history[--this._pointer];
    action.undo(this.project);
    // The selection persists across undo/redo, but the action's project
    // mutations replace connection-point instances (a wire/component move
    // cycles the terminations at its junctions, destroying and recreating
    // the dot at an exactly-3-termination point) — re-derive which dots are
    // highlighted so the selection keeps holding live instances.
    this.project.selectionManager.retintCps();
    this.logging.debug(
      `undo ${action.constructor.name} → pointer ${this._pointer}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  public redo(): void {
    if (this.locked) {
      this.logging.debug('redo ignored: a drag session is live', 'ActionManager');
      return;
    }
    if (!this.redoAvailable) return;

    const action = this._history[this._pointer++];
    action.do(this.project);
    // Same as undo: keep the highlighted dots pointing at live instances.
    this.project.selectionManager.retintCps();
    this.logging.debug(
      `redo ${action.constructor.name} → pointer ${this._pointer}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  public clear(): void {
    this.logging.debug(
      `clear dropping ${this._history.length} action(s)`,
      'ActionManager'
    );
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
