import { ActionContainer } from './action-container';
import { Action } from './action';
import { Project } from '../project/project';

function makeProject(): jasmine.SpyObj<Project> {
	return jasmine.createSpyObj<Project>('Project', ['addComponent']);
}

function makeAction(): jasmine.SpyObj<Action> {
	return jasmine.createSpyObj<Action>('Action', ['do', 'undo']);
}

describe('ActionContainer', () => {
	let project: jasmine.SpyObj<Project>;

	beforeEach(() => {
		project = makeProject();
	});

	// ── Empty container ───────────────────────────────────────────────────────

	describe('empty container', () => {
		it('do() does not throw on an empty container', () => {
			const container = new ActionContainer();
			expect(() => container.do(project)).not.toThrow();
		});

		it('undo() does not throw on an empty container', () => {
			const container = new ActionContainer();
			expect(() => container.undo(project)).not.toThrow();
		});

		it('length is 0 for an empty container', () => {
			const container = new ActionContainer();
			expect(container.length).toBe(0);
		});
	});

	// ── length ────────────────────────────────────────────────────────────────

	describe('length', () => {
		it('returns 1 for a container with a single action', () => {
			const container = new ActionContainer(makeAction());
			expect(container.length).toBe(1);
		});

		it('returns the correct count for multiple constructor actions', () => {
			const container = new ActionContainer(
				makeAction(),
				makeAction(),
				makeAction()
			);
			expect(container.length).toBe(3);
		});
	});

	// ── do() ─────────────────────────────────────────────────────────────────

	describe('do()', () => {
		it('calls do() on every contained action', () => {
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();
			const container = new ActionContainer(a1, a2, a3);

			container.do(project);

			expect(a1.do).toHaveBeenCalledOnceWith(project);
			expect(a2.do).toHaveBeenCalledOnceWith(project);
			expect(a3.do).toHaveBeenCalledOnceWith(project);
		});

		it('calls do() in forward order (first to last)', () => {
			const callOrder: number[] = [];
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();

			a1.do.and.callFake(() => callOrder.push(1));
			a2.do.and.callFake(() => callOrder.push(2));
			a3.do.and.callFake(() => callOrder.push(3));

			const container = new ActionContainer(a1, a2, a3);
			container.do(project);

			expect(callOrder).toEqual([1, 2, 3]);
		});

		it('does not call undo() on any action during do()', () => {
			const a1 = makeAction();
			const a2 = makeAction();
			const container = new ActionContainer(a1, a2);

			container.do(project);

			expect(a1.undo).not.toHaveBeenCalled();
			expect(a2.undo).not.toHaveBeenCalled();
		});
	});

	// ── undo() ────────────────────────────────────────────────────────────────

	describe('undo()', () => {
		it('calls undo() on every contained action', () => {
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();
			const container = new ActionContainer(a1, a2, a3);

			container.undo(project);

			expect(a1.undo).toHaveBeenCalledOnceWith(project);
			expect(a2.undo).toHaveBeenCalledOnceWith(project);
			expect(a3.undo).toHaveBeenCalledOnceWith(project);
		});

		it('calls undo() in REVERSE order (last to first)', () => {
			const callOrder: number[] = [];
			const a1 = makeAction();
			const a2 = makeAction();
			const a3 = makeAction();

			a1.undo.and.callFake(() => callOrder.push(1));
			a2.undo.and.callFake(() => callOrder.push(2));
			a3.undo.and.callFake(() => callOrder.push(3));

			const container = new ActionContainer(a1, a2, a3);
			container.undo(project);

			expect(callOrder).toEqual([3, 2, 1]);
		});

		it('does not call do() on any action during undo()', () => {
			const a1 = makeAction();
			const a2 = makeAction();
			const container = new ActionContainer(a1, a2);

			container.undo(project);

			expect(a1.do).not.toHaveBeenCalled();
			expect(a2.do).not.toHaveBeenCalled();
		});
	});

	// ── add() ─────────────────────────────────────────────────────────────────

	describe('add()', () => {
		it('increases length by 1', () => {
			const container = new ActionContainer(makeAction());
			expect(container.length).toBe(1);
			container.add(makeAction());
			expect(container.length).toBe(2);
		});

		it('increases length correctly when adding to an empty container', () => {
			const container = new ActionContainer();
			container.add(makeAction());
			expect(container.length).toBe(1);
		});

		it('the added action is included in a subsequent do()', () => {
			const existing = makeAction();
			const added = makeAction();
			const container = new ActionContainer(existing);

			container.add(added);
			container.do(project);

			expect(added.do).toHaveBeenCalledOnceWith(project);
		});

		it('the added action is included in a subsequent undo()', () => {
			const existing = makeAction();
			const added = makeAction();
			const container = new ActionContainer(existing);

			container.add(added);
			container.undo(project);

			expect(added.undo).toHaveBeenCalledOnceWith(project);
		});

		it('the added action is called last in do() (appended at the end)', () => {
			const callOrder: string[] = [];
			const a1 = makeAction();
			const a2 = makeAction();

			a1.do.and.callFake(() => callOrder.push('a1'));
			a2.do.and.callFake(() => callOrder.push('a2'));

			const container = new ActionContainer(a1);
			container.add(a2);
			container.do(project);

			expect(callOrder).toEqual(['a1', 'a2']);
		});

		it('the added action is called first in undo() (reverse order, so it is last)', () => {
			const callOrder: string[] = [];
			const a1 = makeAction();
			const a2 = makeAction();

			a1.undo.and.callFake(() => callOrder.push('a1'));
			a2.undo.and.callFake(() => callOrder.push('a2'));

			const container = new ActionContainer(a1);
			container.add(a2);
			container.undo(project);

			// a2 was appended last, so it is undone first
			expect(callOrder).toEqual(['a2', 'a1']);
		});

		it('multiple add() calls accumulate correctly', () => {
			const container = new ActionContainer();
			container.add(makeAction());
			container.add(makeAction());
			container.add(makeAction());
			expect(container.length).toBe(3);
		});
	});
});
