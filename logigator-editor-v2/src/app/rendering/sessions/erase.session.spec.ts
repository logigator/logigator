import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { EraseSession } from './erase.session';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { ActionContainer } from '../../actions/action-container';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import type { Project } from '../../project/project';
import type { ActionManager } from '../../actions/action-manager';

function* gen<T>(...items: T[]): Generator<T> {
	yield* items;
}

function makeAnd(): AndComponent {
	return new AndComponent({
		direction: andComponentConfig.options.direction.clone(),
		numInputs: andComponentConfig.options.numInputs.clone(2)
	});
}

function makeEvent(
	x: number,
	y: number
): jasmine.SpyObj<FederatedPointerEvent> {
	const e = jasmine.createSpyObj<FederatedPointerEvent>(
		'FederatedPointerEvent',
		['getLocalPosition']
	);
	e.getLocalPosition.and.returnValue(new Point(x, y));
	return e;
}

describe('EraseSession', () => {
	let project: jasmine.SpyObj<Project>;

	function getActionManager(): jasmine.SpyObj<ActionManager> {
		return (
			project as unknown as { actionManager: jasmine.SpyObj<ActionManager> }
		).actionManager;
	}

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));

		project = jasmine.createSpyObj<Project>('Project', [
			'removeComponent',
			'removeWire',
			'addComponent',
			'addWire',
			'queryComponentsInRange',
			'queryWiresInRange'
		]);
		// Use callFake so each call gets a fresh (non-exhausted) iterable
		project.queryComponentsInRange.and.callFake(() => gen());
		project.queryWiresInRange.and.callFake(() => gen());

		(
			project as unknown as { actionManager: jasmine.SpyObj<ActionManager> }
		).actionManager = jasmine.createSpyObj<ActionManager>('ActionManager', [
			'register'
		]);
		(project as unknown as { gridSpace: object }).gridSpace = {};
	});

	describe('construction — initial click position', () => {
		it('erases a component at the start position immediately', () => {
			const comp = makeAnd();
			project.queryComponentsInRange.and.callFake(() => gen(comp));

			new EraseSession(project, new Point(3, 2));

			expect(project.removeComponent).toHaveBeenCalledOnceWith(comp.id);
			comp.destroy({ children: true });
		});

		it('erases a wire at the start position immediately', () => {
			const wire = new Wire(WireDirection.HORIZONTAL, 3);
			project.queryWiresInRange.and.callFake(() => gen(wire));

			new EraseSession(project, new Point(3, 2));

			expect(project.removeWire).toHaveBeenCalledOnceWith(wire.id);
			wire.destroy();
		});

		it('queries a 1×1 cell at the floored start position', () => {
			new EraseSession(project, new Point(3.7, 2.9));

			expect(project.queryComponentsInRange).toHaveBeenCalledWith(
				jasmine.objectContaining({ x: 3, y: 2, width: 1, height: 1 })
			);
		});
	});

	describe('onMove()', () => {
		it('erases elements under the cursor', () => {
			const wire = new Wire(WireDirection.HORIZONTAL, 3);
			const session = new EraseSession(project, new Point(0, 0));

			project.queryWiresInRange.and.callFake(() => gen(wire));
			session.onMove(makeEvent(5, 3));

			expect(project.removeWire).toHaveBeenCalledWith(wire.id);
			wire.destroy();
		});

		it('sweeps the AABB between previous and current positions', () => {
			const session = new EraseSession(project, new Point(2, 1));
			session.onMove(makeEvent(7, 4));

			expect(project.queryWiresInRange).toHaveBeenCalledWith(
				jasmine.objectContaining({ x: 2, y: 1, width: 6, height: 4 })
			);
		});

		it('does not erase the same element twice across multiple moves', () => {
			const wire = new Wire(WireDirection.HORIZONTAL, 3);
			project.queryWiresInRange.and.callFake(() => gen(wire));

			const session = new EraseSession(project, new Point(0, 0));
			// Wire already erased in constructor; subsequent moves should skip it
			session.onMove(makeEvent(3, 2));
			session.onMove(makeEvent(4, 2));

			expect(project.removeWire).toHaveBeenCalledOnceWith(wire.id);
			wire.destroy();
		});

		it('erases both components and wires encountered along the path', () => {
			const comp = makeAnd();
			const wire = new Wire(WireDirection.VERTICAL, 2);
			const session = new EraseSession(project, new Point(0, 0));

			project.queryComponentsInRange.and.callFake(() => gen(comp));
			project.queryWiresInRange.and.callFake(() => gen(wire));
			session.onMove(makeEvent(3, 3));

			expect(project.removeComponent).toHaveBeenCalledWith(comp.id);
			expect(project.removeWire).toHaveBeenCalledWith(wire.id);
			comp.destroy({ children: true });
			wire.destroy();
		});
	});

	describe('canEnd()', () => {
		it('always returns true', () => {
			const session = new EraseSession(project, new Point(0, 0));
			expect(session.canEnd()).toBeTrue();
		});
	});

	describe('onEnd()', () => {
		it('registers an ActionContainer when elements were erased', () => {
			const wire = new Wire(WireDirection.HORIZONTAL, 3);
			project.queryWiresInRange.and.callFake(() => gen(wire));

			const session = new EraseSession(project, new Point(0, 0));
			session.onEnd();

			expect(getActionManager().register).toHaveBeenCalledOnceWith(
				jasmine.any(ActionContainer)
			);
			wire.destroy();
		});

		it('does not register an action when nothing was erased', () => {
			const session = new EraseSession(project, new Point(0, 0));
			session.onEnd();

			expect(getActionManager().register).not.toHaveBeenCalled();
		});
	});

	describe('onCancel()', () => {
		it('re-adds deleted wires', () => {
			const wire = new Wire(WireDirection.HORIZONTAL, 3);
			project.queryWiresInRange.and.callFake(() => gen(wire));

			const session = new EraseSession(project, new Point(0, 0));
			session.onCancel();

			expect(project.addWire).toHaveBeenCalledOnceWith(jasmine.any(Wire));
			wire.destroy();
		});

		it('re-adds deleted components', () => {
			const comp = makeAnd();
			project.queryComponentsInRange.and.callFake(() => gen(comp));

			const session = new EraseSession(project, new Point(0, 0));
			session.onCancel();

			expect(project.addComponent).toHaveBeenCalledOnceWith(
				jasmine.any(AndComponent)
			);
			comp.destroy({ children: true });
		});
	});
});
