import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, FederatedPointerEvent, Point } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { Component } from '../../components/component';
import { SelectionMoveSession } from './selection-move.session';

// SelectionMoveSession places selected items into dragLayer at their original positions.
// dragLayer.position = roundToGrid(currentCursor) - pointerStart = movement delta.
// Collision world bounds = item.gridBounds (local) + dragLayer.position (delta).

function makeWire(gx: number, gy: number, dir: WireDirection, length: number): Wire {
	const w = new Wire(dir, length);
	w.position.set(gx + 0.5, gy + 0.5);
	return w;
}

function makeAnd(numInputs = 2): AndComponent {
	return new AndComponent([
		andComponentConfig.options[0].clone(),
		andComponentConfig.options[1].clone(numInputs)
	]);
}

function makeMoveEvent(x: number, y: number): FederatedPointerEvent {
	return { getLocalPosition: () => new Point(x, y) } as unknown as FederatedPointerEvent;
}

describe('SelectionMoveSession collision', () => {
	let project: Project;
	let dragLayer: Container<Component | Wire>;
	let session: SelectionMoveSession;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
		dragLayer = new Container<Component | Wire>();
	});

	afterEach(() => {
		session?.onCancel();
		dragLayer.destroy();
		project.destroy({ children: true });
	});

	describe('component movement', () => {
		it('canEnd() is false when component is moved onto another component', () => {
			// Stationary component at (5,0). Selected component at (0,0).
			const stationary = makeAnd();
			stationary.position.set(5, 0);
			project.addComponent(stationary);

			const selected = makeAnd();
			selected.position.set(0, 0);
			project.addComponent(selected);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set([selected]), new Set(),
				new Point(0, 0)
			);

			// Move selected component to (5,0) → overlaps stationary
			session.onMove(makeMoveEvent(5, 0));
			expect(session.canEnd()).toBeFalse();
		});

		it('canEnd() is false when component body is moved onto a wire — catches missing wire check bug', () => {
			// Wire in project at (5,0) len=3: gridBounds=[5,9)×[0,1).
			// Selected AND gate at (0,0): body Rectangle(0,0,2,2).
			// After move delta=(5,0): body world=Rectangle(5,0,2,2) → overlaps wire.
			const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 3);
			project.addWire(wire);

			const selected = makeAnd();
			selected.position.set(0, 0);
			project.addComponent(selected);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set([selected]), new Set(),
				new Point(0, 0)
			);

			session.onMove(makeMoveEvent(5, 0));
			expect(session.canEnd()).toBeFalse();
			wire.destroy();
		});

		it('canEnd() is true when component is moved to clear space', () => {
			const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 3);
			project.addWire(wire);

			const selected = makeAnd();
			selected.position.set(0, 0);
			project.addComponent(selected);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set([selected]), new Set(),
				new Point(0, 0)
			);

			// Move to (0,10) — far from the wire
			session.onMove(makeMoveEvent(0, 10));
			expect(session.canEnd()).toBeTrue();
			wire.destroy();
		});
	});

	describe('wire movement', () => {
		it('canEnd() is false when wire is moved onto a component body — catches missing wire check bug', () => {
			// Stationary component at (5,0): body Rectangle(5,0,2,2).
			// Selected wire at (0,0) HORIZONTAL len=3: gridBounds=[0,4)×[0,1).
			// After move delta=(5,0): wire world bounds=[5,9)×[0,1) → intersects body.
			const stationary = makeAnd();
			stationary.position.set(5, 0);
			project.addComponent(stationary);

			const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
			project.addWire(wire);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set(), new Set([wire]),
				new Point(0, 0)
			);

			session.onMove(makeMoveEvent(5, 0));
			expect(session.canEnd()).toBeFalse();
		});

		it('canEnd() is true when wire is moved to clear space', () => {
			const stationary = makeAnd();
			stationary.position.set(5, 0);
			project.addComponent(stationary);

			const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
			project.addWire(wire);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set(), new Set([wire]),
				new Point(0, 0)
			);

			// Move to (0,10) — clear of the component
			session.onMove(makeMoveEvent(0, 10));
			expect(session.canEnd()).toBeTrue();
		});

		it('canEnd() is false when wire is moved onto a component, then clears when moved away', () => {
			const stationary = makeAnd();
			stationary.position.set(5, 0);
			project.addComponent(stationary);

			const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
			project.addWire(wire);

			session = new SelectionMoveSession(
				project, dragLayer,
				new Set(), new Set([wire]),
				new Point(0, 0)
			);

			session.onMove(makeMoveEvent(5, 0));
			expect(session.canEnd()).toBeFalse();

			session.onMove(makeMoveEvent(0, 10));
			expect(session.canEnd()).toBeTrue();
		});
	});
});