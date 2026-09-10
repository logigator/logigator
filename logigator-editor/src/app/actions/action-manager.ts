import { Observable, Subject } from 'rxjs';
import { Action } from './action';
import { ActionContainer } from './action-container';
import { Project } from '../project/project';
import { LoggingService } from '../logging/logging.service';
import { getStaticDI } from '../utils/get-di';

/**
 * Undo/redo history, with two commit styles:
 *
 * - {@link push} records the action and runs its `do()` — for instantaneous,
 *   non-gesture operations built against the current state.
 * - {@link register} records it without running `do()` — for drag sessions,
 *   which materialize their final state during the gesture. Re-running `do()`
 *   would double-apply and re-deserialize ids already in the tree.
 */
export class ActionManager {
  private _history: Action[] = [];
  private _pointer = 0;

  private readonly logging = getStaticDI(LoggingService);

  private readonly _actionChange$ = new Subject<void>();
  public readonly actionChange$: Observable<void> =
    this._actionChange$.asObservable();

  // While locked, undo/redo are inert but recording stays allowed — for
  // interactions that hold project state mid-mutation.
  public locked = false;

  // Guarded against re-entry: a hook that records an action itself must not
  // re-trigger the hook pass.
  private readonly _beforeRecordHooks: ((action: Action) => void)[] = [];
  private _notifyingHooks = false;

  constructor(private readonly project: Project) {}

  /**
   * Registers a hook running synchronously before {@link push} or
   * {@link register} records an action. A hook may mutate the history itself —
   * {@link retract} a provisional entry it owns, say — before the new action
   * lands, without re-entering the hook pass. Returns an unsubscribe function.
   */
  public onBeforeRecord(hook: (action: Action) => void): () => void {
    this._beforeRecordHooks.push(hook);
    return () => {
      const index = this._beforeRecordHooks.indexOf(hook);
      if (index !== -1) this._beforeRecordHooks.splice(index, 1);
    };
  }

  private _notifyBeforeRecord(action: Action): void {
    if (this._notifyingHooks) return;
    this._notifyingHooks = true;
    try {
      for (const hook of [...this._beforeRecordHooks]) {
        hook(action);
      }
    } finally {
      this._notifyingHooks = false;
    }
  }

  /** The newest done action — the entry the next undo would revert. */
  public get topDone(): Action | null {
    return this._pointer > 0 ? this._history[this._pointer - 1] : null;
  }

  public push(action: Action): void {
    this._notifyBeforeRecord(action);
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
    this._notifyBeforeRecord(action);
    this._history.splice(this._pointer, Infinity, action);
    this._pointer = this._history.length;
    this.logging.debug(
      `register ${action.constructor.name} without do() → pointer ${this._pointer}, history ${this._history.length}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  /**
   * Reverts and removes an action, provided it is still the newest done entry,
   * so a provisional entry can leave no trace. Returns false and touches
   * nothing otherwise.
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
   * Collapses a provisional entry and the operation finalizing it into one
   * undo step, by replacing the newest done entry with a container over both.
   * Executes nothing, so `next`'s state must already be materialized. Falls
   * back to a plain {@link register} when `expectedTop` is no longer on top.
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

  public undo(): void {
    if (this.locked) {
      this.logging.debug('undo ignored while locked', 'ActionManager');
      return;
    }

    if (!this.undoAvailable) return;

    const action = this._history[--this._pointer];
    action.undo(this.project);
    // The selection survives undo/redo, but the mutations replace
    // connection-point instances, so re-derive which dots are highlighted and
    // keep the selection holding live ones.
    this.project.selectionManager.retintCps();
    this.logging.debug(
      `undo ${action.constructor.name} → pointer ${this._pointer}`,
      'ActionManager'
    );
    this._actionChange$.next();
  }

  public redo(): void {
    if (this.locked) {
      this.logging.debug('redo ignored while locked', 'ActionManager');
      return;
    }
    if (!this.redoAvailable) return;

    const action = this._history[this._pointer++];
    action.do(this.project);
    // Keep the highlighted dots pointing at live instances.
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

  /** The recorded actions, oldest first. */
  public get history(): readonly Action[] {
    return this._history;
  }

  /** Index of the next redo, i.e. the number of done actions. */
  public get pointer(): number {
    return this._pointer;
  }

  /**
   * Replaces the history and pointer wholesale without re-applying anything:
   * the project must already hold the matching post-`do` state. The pointer is
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
   * Completes {@link actionChange$} so subscribers release without an explicit
   * unsubscribe. The manager is single-use afterwards.
   */
  public destroy(): void {
    this._actionChange$.complete();
    this._beforeRecordHooks.length = 0;
  }
}
