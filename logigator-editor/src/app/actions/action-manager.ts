import { Observable, Subject } from 'rxjs';
import { Action } from './action';
import { ActionContainer } from './action-container';
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

  // Reentrancy guard for the live-cut dissolve below: clearing the selection
  // retracts the cut, and nothing that runs inside that may dissolve again.
  private _dissolving = false;

  constructor(private readonly project: Project) {}

  /** The newest done action — the entry the next undo would revert. */
  public get topDone(): Action | null {
    return this._pointer > 0 ? this._history[this._pointer - 1] : null;
  }

  public push(action: Action): void {
    this._dissolveLiveCut();
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
    this._dissolveLiveCut();
    this._history.splice(this._pointer, Infinity, action);
    this._pointer = this._history.length;
    this.logging.debug(
      `register ${action.constructor.name} without do() → pointer ${this._pointer}, history ${this._history.length}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  /**
   * Reverts and removes an action, provided it is still the newest done entry
   * — how a cancelled scissor selection takes its cut back out of history so
   * it leaves no trace. Returns false (touching nothing) otherwise.
   */
  public retract(action: Action): boolean {
    if (this.topDone !== action) return false;
    action.undo(this.project);
    this._history.splice(this._pointer - 1, Infinity);
    this._pointer = this._history.length;
    this.logging.debug(
      `retract ${action.constructor.name} → pointer ${this._pointer}`,
      'ActionManager'
    );
    this._actionChange$.next();
    return true;
  }

  /**
   * Replaces the newest done entry with a container grouping it and `next`,
   * WITHOUT executing anything — `next`'s state must already be materialized
   * (the register convention). This is how a scissor cut and the move/delete
   * that commits it collapse into one undo step. Falls back to a plain
   * register when `expectedTop` is no longer on top (it then stays its own
   * undo step).
   */
  public coalesceTop(expectedTop: Action, next: Action): void {
    if (this.topDone !== expectedTop) {
      this.logging.warn(
        `coalesceTop: expected top is not the newest entry; registering ${next.constructor.name} separately`,
        'ActionManager'
      );
      this.register(next);
      return;
    }
    this._history.splice(
      this._pointer - 1,
      Infinity,
      new ActionContainer(expectedTop, next)
    );
    this._pointer = this._history.length;
    this.logging.debug(
      `coalesceTop ${expectedTop.constructor.name} + ${next.constructor.name} → pointer ${this._pointer}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  /**
   * A live scissor cut only stays in history as long as a move or delete can
   * still commit it. Any unrelated action landing on top would orphan it as
   * an invisible wire split, so dissolve first: clearing the selection
   * retracts the cut. Lazy `selectionManager` access matters — Project
   * constructs actionManager (this) before selectionManager.
   */
  private _dissolveLiveCut(): void {
    if (this._dissolving) return;
    const selectionManager = this.project.selectionManager;
    if (!selectionManager?.hasLiveCut) return;
    this._dissolving = true;
    try {
      this.logging.debug(
        'dissolving live scissor cut before recording an unrelated action',
        'ActionManager'
      );
      selectionManager.clear();
    } finally {
      this._dissolving = false;
    }
  }

  public undo(): void {
    if (this.locked) {
      this.logging.debug('undo ignored: a drag session is live', 'ActionManager');
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
