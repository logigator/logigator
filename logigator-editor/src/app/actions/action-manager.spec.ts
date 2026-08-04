import type { MockedObject } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { ActionManager } from './action-manager';
import { Project } from '../project/project';
import { makeAction } from '../../testing/action-mocks';

function makeProject(): MockedObject<Project> {
  const project = {
    addComponent: vi.fn().mockName('Project.addComponent'),
    selectionManager: {
      retintCps: () => undefined
    }
  };

  return project as unknown as MockedObject<Project>;
}

describe('ActionManager', () => {
  let project: MockedObject<Project>;
  let manager: ActionManager;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = makeProject();
    manager = new ActionManager(project);
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('undoAvailable is false on a new manager', () => {
      expect(manager.undoAvailable).toBe(false);
    });

    it('redoAvailable is false on a new manager', () => {
      expect(manager.redoAvailable).toBe(false);
    });
  });

  // ── push ──────────────────────────────────────────────────────────────────

  describe('push', () => {
    it('calls action.do() with the project', () => {
      const action = makeAction();
      manager.push(action);
      expect(action.do).toHaveBeenCalledTimes(1);
      expect(action.do).toHaveBeenCalledWith(project);
    });

    it('makes undoAvailable true after a push', () => {
      manager.push(makeAction());
      expect(manager.undoAvailable).toBe(true);
    });

    it('redoAvailable remains false after a push', () => {
      manager.push(makeAction());
      expect(manager.redoAvailable).toBe(false);
    });
  });

  // ── undo ──────────────────────────────────────────────────────────────────

  describe('undo', () => {
    it('calls action.undo() with the project', () => {
      const action = makeAction();
      manager.push(action);
      manager.undo();
      expect(action.undo).toHaveBeenCalledTimes(1);
      expect(action.undo).toHaveBeenCalledWith(project);
    });

    it('makes undoAvailable false after undoing the only action', () => {
      manager.push(makeAction());
      manager.undo();
      expect(manager.undoAvailable).toBe(false);
    });

    it('does nothing when history is empty', () => {
      expect(() => manager.undo()).not.toThrow();
      expect(manager.undoAvailable).toBe(false);
    });

    it('does not call undo on any action when history is empty', () => {
      const action = makeAction();
      // push then undo to empty undo stack, then undo again
      manager.push(action);
      manager.undo();
      action.undo.mockClear();
      manager.undo();
      expect(action.undo).not.toHaveBeenCalled();
    });
  });

  // ── redo ──────────────────────────────────────────────────────────────────

  describe('redo', () => {
    it('calls action.do() again after an undo', () => {
      const action = makeAction();
      manager.push(action);
      manager.undo();
      action.do.mockClear();
      manager.redo();
      expect(action.do).toHaveBeenCalledTimes(1);
      expect(action.do).toHaveBeenCalledWith(project);
    });

    it('makes redoAvailable false after redoing the only undone action', () => {
      manager.push(makeAction());
      manager.undo();
      manager.redo();
      expect(manager.redoAvailable).toBe(false);
    });

    it('does nothing when at the end of history', () => {
      manager.push(makeAction());
      expect(() => manager.redo()).not.toThrow();
      expect(manager.redoAvailable).toBe(false);
    });

    it('does not call do on any action when there is nothing to redo', () => {
      const action = makeAction();
      manager.push(action);
      action.do.mockClear();
      manager.redo();
      expect(action.do).not.toHaveBeenCalled();
    });

    it('makes undoAvailable true again after redo', () => {
      manager.push(makeAction());
      manager.undo();
      expect(manager.undoAvailable).toBe(false);
      manager.redo();
      expect(manager.undoAvailable).toBe(true);
    });
  });

  // ── undo intercepts pending scissor cut ──────────────────────────────────

  describe('retract', () => {
    it('reverts and removes the newest done entry', () => {
      const action = makeAction();
      manager.register(action);

      expect(manager.retract(action)).toBe(true);

      expect(action.undo).toHaveBeenCalledTimes(1);
      expect(action.undo).toHaveBeenCalledWith(project);
      expect(manager.undoAvailable).toBe(false);
      expect(manager.redoAvailable).toBe(false);
    });

    it('refuses to touch an action that is not the newest done entry', () => {
      const older = makeAction();
      const newer = makeAction();
      manager.register(older);
      manager.register(newer);

      expect(manager.retract(older)).toBe(false);

      expect(older.undo).not.toHaveBeenCalled();
      expect(manager.topDone).toBe(newer);
    });

    it('refuses an entry the user has already undone', () => {
      const action = makeAction();
      manager.register(action);
      manager.undo();

      expect(manager.retract(action)).toBe(false);
      // Its single undo came from the history operation, not the retract.
      expect(action.undo).toHaveBeenCalledTimes(1);
      expect(manager.redoAvailable).toBe(true);
    });
  });

  describe('coalesceTop', () => {
    it('merges the newest entry and the next action into one undo step without executing', () => {
      const cut = makeAction();
      const move = makeAction();
      manager.register(cut);
      manager.coalesceTop(cut, move);

      expect(cut.do).not.toHaveBeenCalled();
      expect(move.do).not.toHaveBeenCalled();

      // One undo reverts both, in reverse order.
      manager.undo();
      expect(move.undo).toHaveBeenCalledTimes(1);
      expect(cut.undo).toHaveBeenCalledTimes(1);
      expect(manager.undoAvailable).toBe(false);

      // One redo re-applies both.
      manager.redo();
      expect(cut.do).toHaveBeenCalledTimes(1);
      expect(move.do).toHaveBeenCalledTimes(1);
    });

    it('registers the next action separately when the expected top no longer is', () => {
      const cut = makeAction();
      const other = makeAction();
      const move = makeAction();
      manager.register(cut);
      manager.register(other);

      manager.coalesceTop(cut, move);

      // move became its own entry; one undo reverts only it.
      manager.undo();
      expect(move.undo).toHaveBeenCalledTimes(1);
      expect(other.undo).not.toHaveBeenCalled();
    });
  });

  describe('onBeforeRecord hooks', () => {
    it('runs hooks with the action before push and register record it', () => {
      const hook = vi.fn();
      manager.onBeforeRecord(hook);

      const pushed = makeAction();
      manager.push(pushed);
      expect(hook).toHaveBeenNthCalledWith(1, pushed);

      const registered = makeAction();
      manager.register(registered);
      expect(hook).toHaveBeenNthCalledWith(2, registered);
    });

    it('does not run hooks on undo, redo or retract', () => {
      const action = makeAction();
      manager.register(action);

      const hook = vi.fn();
      manager.onBeforeRecord(hook);

      manager.undo();
      manager.redo();
      manager.retract(action);

      expect(hook).not.toHaveBeenCalled();
    });

    it('lets a hook retract a provisional entry before the new action lands', () => {
      const provisional = makeAction();
      manager.register(provisional);
      manager.onBeforeRecord(() => manager.retract(provisional));

      const next = makeAction();
      manager.push(next);

      expect(provisional.undo).toHaveBeenCalledTimes(1);
      expect(manager.history).toEqual([next]);
      expect(manager.topDone).toBe(next);
    });

    it('does not re-enter hooks when a hook records an action', () => {
      const hook = vi.fn(() => manager.register(makeAction()));
      manager.onBeforeRecord(hook);

      manager.push(makeAction());

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('stops delivering after unsubscribe', () => {
      const hook = vi.fn();
      const unsubscribe = manager.onBeforeRecord(hook);

      unsubscribe();
      manager.push(makeAction());

      expect(hook).not.toHaveBeenCalled();
    });
  });

  // ── locked (a drag session is live) ────────────────────────────────────────

  describe('locked', () => {
    it('ignores undo while locked, then undoes after unlocking', () => {
      const action = makeAction();
      manager.push(action);

      manager.locked = true;
      manager.undo();
      expect(action.undo).not.toHaveBeenCalled();
      expect(manager.undoAvailable).toBe(true);

      manager.locked = false;
      manager.undo();
      expect(action.undo).toHaveBeenCalledTimes(1);
    });

    it('ignores redo while locked', () => {
      const action = makeAction();
      manager.push(action);
      manager.undo();

      manager.locked = true;
      manager.redo();
      expect(action.do).toHaveBeenCalledTimes(1); // only the original push
      expect(manager.redoAvailable).toBe(true);
    });

    it('still records commits while locked (sessions register before unlock)', () => {
      manager.locked = true;
      manager.register(makeAction());
      expect(manager.undoAvailable).toBe(true);
    });
  });

  // ── push after undo truncates future ──────────────────────────────────────

  describe('push after undo', () => {
    it('discards redo history when a new action is pushed after an undo', () => {
      const a1 = makeAction();
      const a2 = makeAction();
      const a3 = makeAction();

      manager.push(a1);
      manager.push(a2);
      manager.undo(); // pointer now at a1; a2 is in redo history

      manager.push(a3); // should truncate a2 from redo history

      expect(manager.redoAvailable).toBe(false);
    });

    it('the old future action is never redone after truncation', () => {
      const a1 = makeAction();
      const a2 = makeAction();
      const a3 = makeAction();

      manager.push(a1);
      manager.push(a2);
      manager.undo();
      a2.do.mockClear();

      manager.push(a3);
      // redo is not available so this is a no-op; a2.do must not be called
      manager.redo();
      expect(a2.do).not.toHaveBeenCalled();
    });

    it('undoAvailable is true for the newly pushed action after truncation', () => {
      const a1 = makeAction();
      const a2 = makeAction();

      manager.push(a1);
      manager.undo();
      manager.push(a2);

      expect(manager.undoAvailable).toBe(true);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('resets undoAvailable to false', () => {
      manager.push(makeAction());
      manager.clear();
      expect(manager.undoAvailable).toBe(false);
    });

    it('resets redoAvailable to false', () => {
      manager.push(makeAction());
      manager.undo();
      manager.clear();
      expect(manager.redoAvailable).toBe(false);
    });

    it('makes undo a no-op after clearing', () => {
      const action = makeAction();
      manager.push(action);
      manager.clear();
      action.undo.mockClear();
      manager.undo();
      expect(action.undo).not.toHaveBeenCalled();
    });

    it('makes redo a no-op after clearing', () => {
      const action = makeAction();
      manager.push(action);
      manager.undo();
      manager.clear();
      action.do.mockClear();
      manager.redo();
      expect(action.do).not.toHaveBeenCalled();
    });
  });

  // ── multi-step sequence ───────────────────────────────────────────────────

  describe('multi-step sequence', () => {
    it('push 3, undo 2, redo 1 — correct undoAvailable/redoAvailable state', () => {
      const a1 = makeAction();
      const a2 = makeAction();
      const a3 = makeAction();

      manager.push(a1);
      manager.push(a2);
      manager.push(a3);
      // pointer = 3, undo=true, redo=false

      manager.undo();
      // pointer = 2, undo=true, redo=true
      expect(manager.undoAvailable).toBe(true);
      expect(manager.redoAvailable).toBe(true);

      manager.undo();
      // pointer = 1, undo=true, redo=true
      expect(manager.undoAvailable).toBe(true);
      expect(manager.redoAvailable).toBe(true);

      manager.redo();
      // pointer = 2, undo=true, redo=true
      expect(manager.undoAvailable).toBe(true);
      expect(manager.redoAvailable).toBe(true);
    });

    it('push 3, undo 3 — undoAvailable false, redoAvailable true', () => {
      manager.push(makeAction());
      manager.push(makeAction());
      manager.push(makeAction());
      manager.undo();
      manager.undo();
      manager.undo();

      expect(manager.undoAvailable).toBe(false);
      expect(manager.redoAvailable).toBe(true);
    });

    it('push 3, undo 3, redo 3 — undoAvailable true, redoAvailable false', () => {
      manager.push(makeAction());
      manager.push(makeAction());
      manager.push(makeAction());
      manager.undo();
      manager.undo();
      manager.undo();
      manager.redo();
      manager.redo();
      manager.redo();

      expect(manager.undoAvailable).toBe(true);
      expect(manager.redoAvailable).toBe(false);
    });

    it('undo calls are made in LIFO order', () => {
      const callOrder: string[] = [];
      const a1 = makeAction();
      const a2 = makeAction();
      const a3 = makeAction();

      a1.undo.mockImplementation(() => callOrder.push('a1'));
      a2.undo.mockImplementation(() => callOrder.push('a2'));
      a3.undo.mockImplementation(() => callOrder.push('a3'));

      manager.push(a1);
      manager.push(a2);
      manager.push(a3);

      manager.undo();
      manager.undo();
      manager.undo();

      expect(callOrder).toEqual(['a3', 'a2', 'a1']);
    });
  });

  // ── actionChange$ stream ──────────────────────────────────────────────────
  //
  // Dirty tracking in PersistenceService depends on this Subject firing on
  // every state transition. Cover all four entry points (push / undo / redo
  // / register).

  describe('actionChange$', () => {
    it('emits on push', () => {
      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.push(makeAction());
      expect(count).toBe(1);
    });

    it('emits on register without calling action.do()', () => {
      let count = 0;
      const action = makeAction();
      manager.actionChange$.subscribe(() => count++);

      manager.register(action);

      expect(count).toBe(1);
      expect(action.do).not.toHaveBeenCalled();
    });

    it('emits on undo', () => {
      manager.push(makeAction());

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.undo();
      expect(count).toBe(1);
    });

    it('emits on redo', () => {
      manager.push(makeAction());
      manager.undo();

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.redo();
      expect(count).toBe(1);
    });

    it('does not emit when undo is a no-op (empty history)', () => {
      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.undo();
      expect(count).toBe(0);
    });

    it('does not emit when redo is a no-op (end of history)', () => {
      manager.push(makeAction());

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.redo();
      expect(count).toBe(0);
    });

    it('emits when an entry is retracted', () => {
      const action = makeAction();
      manager.register(action);

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.retract(action);
      expect(count).toBe(1);
    });

    it('does not emit when a retract refuses a non-top entry', () => {
      const older = makeAction();
      manager.register(older);
      manager.register(makeAction());

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.retract(older);
      expect(count).toBe(0);
    });

    it('emits on each transition in a long sequence', () => {
      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.push(makeAction()); // 1
      manager.push(makeAction()); // 2
      manager.undo(); // 3
      manager.undo(); // 4
      manager.redo(); // 5
      manager.register(makeAction()); // 6

      expect(count).toBe(6);
    });
  });
});
