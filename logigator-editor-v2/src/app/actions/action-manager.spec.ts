import { ActionManager } from './action-manager';
import { Action } from './action';
import { Project } from '../project/project';

function makeProject(): jasmine.SpyObj<Project> {
	return jasmine.createSpyObj<Project>('Project', ['addComponent']);
}

function makeAction(): jasmine.SpyObj<Action> {
	return jasmine.createSpyObj<Action>('Action', ['do', 'undo']);
}

describe('ActionManager', () => {
	let project: jasmine.SpyObj<Project>;
	let manager: ActionManager;

	beforeEach(() => {
		project = makeProject();
		manager = new ActionManager(project);
	});

	// ── Initial state ──────────────────────────────────────────────────────────

	describe('initial state', () => {
		it('undoAvailable is false on a new manager', () => {
			expect(manager.undoAvailable).toBeFalse();
		});

		it('redoAvailable is false on a new manager', () => {
			expect(manager.redoAvailable).toBeFalse();
		});
	});

	// ── push ──────────────────────────────────────────────────────────────────

	describe('push', () => {
		it('calls action.do() with the project', () => {
			const action = makeAction();
			manager.push(action);
			expect(action.do).toHaveBeenCalledOnceWith(project);
		});

		it('makes undoAvailable true after a push', () => {
			manager.push(makeAction());
			expect(manager.undoAvailable).toBeTrue();
		});

		it('redoAvailable remains false after a push', () => {
			manager.push(makeAction());
			expect(manager.redoAvailable).toBeFalse();
		});
	});

	// ── undo ──────────────────────────────────────────────────────────────────

	describe('undo', () => {
		it('calls action.undo() with the project', () => {
			const action = makeAction();
			manager.push(action);
			manager.undo();
			expect(action.undo).toHaveBeenCalledOnceWith(project);
		});

		it('makes undoAvailable false after undoing the only action', () => {
			manager.push(makeAction());
			manager.undo();
			expect(manager.undoAvailable).toBeFalse();
		});

		it('does nothing when history is empty', () => {
			expect(() => manager.undo()).not.toThrow();
			expect(manager.undoAvailable).toBeFalse();
		});

		it('does not call undo on any action when history is empty', () => {
			const action = makeAction();
			// push then undo to empty undo stack, then undo again
			manager.push(action);
			manager.undo();
			action.undo.calls.reset();
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
			action.do.calls.reset();
			manager.redo();
			expect(action.do).toHaveBeenCalledOnceWith(project);
		});

		it('makes redoAvailable false after redoing the only undone action', () => {
			manager.push(makeAction());
			manager.undo();
			manager.redo();
			expect(manager.redoAvailable).toBeFalse();
		});

		it('does nothing when at the end of history', () => {
			manager.push(makeAction());
			expect(() => manager.redo()).not.toThrow();
			expect(manager.redoAvailable).toBeFalse();
		});

		it('does not call do on any action when there is nothing to redo', () => {
			const action = makeAction();
			manager.push(action);
			action.do.calls.reset();
			manager.redo();
			expect(action.do).not.toHaveBeenCalled();
		});

		it('makes undoAvailable true again after redo', () => {
			manager.push(makeAction());
			manager.undo();
			expect(manager.undoAvailable).toBeFalse();
			manager.redo();
			expect(manager.undoAvailable).toBeTrue();
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
			manager.undo();           // pointer now at a1; a2 is in redo history

			manager.push(a3);         // should truncate a2 from redo history

			expect(manager.redoAvailable).toBeFalse();
		});

		it('the old future action is never redone after truncation', () => {
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();

			manager.push(a1);
			manager.push(a2);
			manager.undo();
			a2.do.calls.reset();

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

			expect(manager.undoAvailable).toBeTrue();
		});
	});

	// ── clear ─────────────────────────────────────────────────────────────────

	describe('clear', () => {
		it('resets undoAvailable to false', () => {
			manager.push(makeAction());
			manager.clear();
			expect(manager.undoAvailable).toBeFalse();
		});

		it('resets redoAvailable to false', () => {
			manager.push(makeAction());
			manager.undo();
			manager.clear();
			expect(manager.redoAvailable).toBeFalse();
		});

		it('makes undo a no-op after clearing', () => {
			const action = makeAction();
			manager.push(action);
			manager.clear();
			action.undo.calls.reset();
			manager.undo();
			expect(action.undo).not.toHaveBeenCalled();
		});

		it('makes redo a no-op after clearing', () => {
			const action = makeAction();
			manager.push(action);
			manager.undo();
			manager.clear();
			action.do.calls.reset();
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
			expect(manager.undoAvailable).toBeTrue();
			expect(manager.redoAvailable).toBeTrue();

			manager.undo();
			// pointer = 1, undo=true, redo=true
			expect(manager.undoAvailable).toBeTrue();
			expect(manager.redoAvailable).toBeTrue();

			manager.redo();
			// pointer = 2, undo=true, redo=true
			expect(manager.undoAvailable).toBeTrue();
			expect(manager.redoAvailable).toBeTrue();
		});

		it('push 3, undo 3 — undoAvailable false, redoAvailable true', () => {
			manager.push(makeAction());
			manager.push(makeAction());
			manager.push(makeAction());
			manager.undo();
			manager.undo();
			manager.undo();

			expect(manager.undoAvailable).toBeFalse();
			expect(manager.redoAvailable).toBeTrue();
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

			expect(manager.undoAvailable).toBeTrue();
			expect(manager.redoAvailable).toBeFalse();
		});

		it('undo calls are made in LIFO order', () => {
			const callOrder: string[] = [];
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();

			a1.undo.and.callFake(() => callOrder.push('a1'));
			a2.undo.and.callFake(() => callOrder.push('a2'));
			a3.undo.and.callFake(() => callOrder.push('a3'));

			manager.push(a1);
			manager.push(a2);
			manager.push(a3);

			manager.undo();
			manager.undo();
			manager.undo();

			expect(callOrder).toEqual(['a3', 'a2', 'a1']);
		});
	});
});
