import { describe, beforeEach, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ActionManager } from './action-manager';
import { Action } from './action';
import { Project } from '../project/project';

function makeProject(): MockedObject<Project> {
  const project = {
    addComponent: vi.fn().mockName('Project.addComponent'),
    selectionManager: {
      rollbackPendingCut: () => false
    }
  };
   
  return project as unknown as MockedObject<Project>;
}

function makeAction(): MockedObject<Action> {
   
  return {
    do: vi.fn().mockName('Action.do'),
    undo: vi.fn().mockName('Action.undo')
  } as unknown as MockedObject<Action>;
}

describe('ActionManager', () => {
  let project: MockedObject<Project>;
  let manager: ActionManager;

  beforeEach(() => {
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

  describe('undo with pending scissor cut', () => {
    it('rolls back the pending cut and does not consume the history', () => {
      const action = makeAction();
      manager.push(action);

      // Pretend a SELECT_EXACT cut is pending.
      (
        project as never as {
          selectionManager: {
            rollbackPendingCut: () => boolean;
          };
        }
      ).selectionManager.rollbackPendingCut = () => true;

      manager.undo();

      expect(action.undo).not.toHaveBeenCalled();
      expect(manager.undoAvailable).toBe(true);
    });

    it('falls through to history undo when no cut is pending', () => {
      const action = makeAction();
      manager.push(action);
      // Default rollbackPendingCut returns false (from makeProject).
      manager.undo();
      expect(action.undo).toHaveBeenCalledTimes(1);
      expect(action.undo).toHaveBeenCalledWith(project);
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

    it('does not emit when undo is intercepted by a pending scissor cut', () => {
      manager.push(makeAction());

      (
        project as never as {
          selectionManager: {
            rollbackPendingCut: () => boolean;
          };
        }
      ).selectionManager.rollbackPendingCut = () => true;

      let count = 0;
      manager.actionChange$.subscribe(() => count++);

      manager.undo();
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
