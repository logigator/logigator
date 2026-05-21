import { Point } from 'pixi.js';
import { MoveWiresAction } from './move-wires.action';
import type { Project } from '../../project/project';

describe('MoveWiresAction', () => {
	let project: jasmine.SpyObj<Project>;

	beforeEach(() => {
		project = jasmine.createSpyObj<Project>('Project', ['moveWire']);
	});

	describe('do()', () => {
		it('calls moveWire with (id, newPos) for a single entry', () => {
			const newPos = new Point(5, 10);
			const action = new MoveWiresAction({
				id: 1,
				oldPos: new Point(0, 0),
				newPos
			});

			action.do(project);

			expect(project.moveWire).toHaveBeenCalledOnceWith(1, newPos);
		});

		it('calls moveWire once per entry for multiple entries', () => {
			const action = new MoveWiresAction(
				{ id: 1, oldPos: new Point(0, 0), newPos: new Point(3, 4) },
				{ id: 2, oldPos: new Point(1, 1), newPos: new Point(7, 8) },
				{ id: 3, oldPos: new Point(2, 2), newPos: new Point(9, 0) }
			);

			action.do(project);

			expect(project.moveWire).toHaveBeenCalledTimes(3);
			expect(project.moveWire).toHaveBeenCalledWith(1, jasmine.objectContaining({ x: 3, y: 4 }));
			expect(project.moveWire).toHaveBeenCalledWith(2, jasmine.objectContaining({ x: 7, y: 8 }));
			expect(project.moveWire).toHaveBeenCalledWith(3, jasmine.objectContaining({ x: 9, y: 0 }));
		});

		it('does not call moveWire when there are no entries', () => {
			const action = new MoveWiresAction();

			expect(() => action.do(project)).not.toThrow();
			expect(project.moveWire).not.toHaveBeenCalled();
		});
	});

	describe('undo()', () => {
		it('calls moveWire with (id, oldPos) for a single entry', () => {
			const oldPos = new Point(0, 0);
			const action = new MoveWiresAction({
				id: 1,
				oldPos,
				newPos: new Point(5, 10)
			});

			action.undo(project);

			expect(project.moveWire).toHaveBeenCalledOnceWith(1, oldPos);
		});

		it('calls moveWire once per entry for multiple entries', () => {
			const action = new MoveWiresAction(
				{ id: 1, oldPos: new Point(0, 0), newPos: new Point(3, 4) },
				{ id: 2, oldPos: new Point(1, 1), newPos: new Point(7, 8) }
			);

			action.undo(project);

			expect(project.moveWire).toHaveBeenCalledTimes(2);
			expect(project.moveWire).toHaveBeenCalledWith(1, jasmine.objectContaining({ x: 0, y: 0 }));
			expect(project.moveWire).toHaveBeenCalledWith(2, jasmine.objectContaining({ x: 1, y: 1 }));
		});

		it('does not call moveWire when there are no entries', () => {
			const action = new MoveWiresAction();

			expect(() => action.undo(project)).not.toThrow();
			expect(project.moveWire).not.toHaveBeenCalled();
		});
	});

	describe('constructor position cloning', () => {
		it('clones oldPos so mutating the original does not affect stored entry', () => {
			const oldPos = new Point(1, 2);
			const action = new MoveWiresAction({
				id: 1,
				oldPos,
				newPos: new Point(5, 6)
			});

			oldPos.set(99, 99);
			action.undo(project);

			expect(project.moveWire).toHaveBeenCalledOnceWith(1, jasmine.objectContaining({ x: 1, y: 2 }));
		});

		it('clones newPos so mutating the original does not affect stored entry', () => {
			const newPos = new Point(5, 6);
			const action = new MoveWiresAction({
				id: 1,
				oldPos: new Point(1, 2),
				newPos
			});

			newPos.set(99, 99);
			action.do(project);

			expect(project.moveWire).toHaveBeenCalledOnceWith(1, jasmine.objectContaining({ x: 5, y: 6 }));
		});
	});
});
