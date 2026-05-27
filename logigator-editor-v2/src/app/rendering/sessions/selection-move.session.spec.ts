import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { Component } from '../../components/component';
import { SelectionMoveSession } from './selection-move.session';
import { WorkMode } from '../../work-mode/work-mode.enum';

// SelectionMoveSession places selected items into dragLayer at their original positions.
// dragLayer.position = roundToGrid(currentCursor) - pointerStart = movement delta.
// Collision world bounds = item.gridBounds (local) + dragLayer.position (delta).

function makeWire(
	gx: number,
	gy: number,
	dir: WireDirection,
	length: number
): Wire {
	const w = new Wire(dir, length);
	w.position.set(gx + 0.5, gy + 0.5);
	return w;
}

function makeAnd(numInputs = 2): AndComponent {
	return new AndComponent({
		direction: andComponentConfig.options.direction.clone(),
		numInputs: andComponentConfig.options.numInputs.clone(numInputs)
	});
}

function makeMoveEvent(x: number, y: number): FederatedPointerEvent {
	return {
		getLocalPosition: () => new Point(x, y)
	} as unknown as FederatedPointerEvent;
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
				project,
				dragLayer,
				new Set([selected]),
				new Set(),
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
				project,
				dragLayer,
				new Set([selected]),
				new Set(),
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
				project,
				dragLayer,
				new Set([selected]),
				new Set(),
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
				project,
				dragLayer,
				new Set(),
				new Set([wire]),
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
				project,
				dragLayer,
				new Set(),
				new Set([wire]),
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
				project,
				dragLayer,
				new Set(),
				new Set([wire]),
				new Point(0, 0)
			);

			session.onMove(makeMoveEvent(5, 0));
			expect(session.canEnd()).toBeFalse();

			session.onMove(makeMoveEvent(0, 10));
			expect(session.canEnd()).toBeTrue();
		});
	});

	// Regression: SELECT_EXACT cut + move must not duplicate wires in the quad
	// tree. The cut materializes new pieces in-memory; folding that cut into
	// the move's ActionContainer and pushing it would cause ActionManager.push
	// to re-run cutContainer.do(), which re-deserializes pieces with IDs already
	// present. SelectionMoveSession uses ActionManager.register (record-without-
	// do) so cut state is recorded once. This test catches a regression of that.
	describe('SELECT_EXACT cut + move (full flow)', () => {
		function allWires(): Wire[] {
			const huge = new Rectangle(-1000, -1000, 2000, 2000);
			return Array.from(project.queryWiresInRange(huge));
		}

		it('produces no duplicate-ID wires after cut + move + push', () => {
			// Horizontal wire spanning (0.5, 0.5) → (10.5, 0.5).
			const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
			project.addWire(wire);

			// Cut at integer rect (5,0)+(2,1): outside [0.5,4.5], inside [4.5,7.5], outside [7.5,10.5].
			project.selectionManager.commit(
				new Rectangle(5, 0, 2, 1),
				WorkMode.SELECT_EXACT
			);

			expect(project.selectionManager.hasPendingCut).toBeTrue();
			expect(allWires().length).toBe(3);

			// Find the inside piece (the one selected).
			const insidePiece = Array.from(project.selectionManager.selectedWires)[0];
			expect(insidePiece).toBeDefined();

			// Drive a move on the inside piece. _pointerStart is one of the wire's
			// covered grid cells; onMove provides the post-move cursor position so
			// the delta lands on integer grid units.
			session = new SelectionMoveSession(
				project,
				dragLayer,
				new Set(),
				new Set([insidePiece]),
				new Point(5, 0)
			);
			// Move delta = (0, 5) — drag the inside piece down to a clear row.
			session.onMove(makeMoveEvent(5, 5));
			expect(session.canEnd()).toBeTrue();
			session.onEnd();

			// Cut+move materialized exactly three wires: two outside + one inside.
			const after = allWires();
			expect(after.length).toBe(3);

			// No duplicate IDs.
			const ids = after.map((w) => w.id);
			expect(new Set(ids).size).toBe(ids.length);

			// Pending cut was claimed.
			expect(project.selectionManager.hasPendingCut).toBeFalse();

			// Undo restores the pre-cut state (the original wire).
			project.actionManager.undo();
			const undone = allWires();
			expect(undone.length).toBe(1);
			expect(undone[0].position.x).toBe(0.5);
			expect(undone[0].length).toBe(10);

			// Redo restores the post-move state.
			project.actionManager.redo();
			const redone = allWires();
			expect(redone.length).toBe(3);
			expect(new Set(redone.map((w) => w.id)).size).toBe(redone.length);
		});

		it('drag wire endpoint onto another wire interior splits the underlying wire', () => {
			// Long horizontal wire (1.5, 0.5)→(11.5, 0.5).
			const long = makeWire(1, 0, WireDirection.HORIZONTAL, 10);
			project.addWire(long);
			// Vertical wire (0.5, -5.5)→(0.5, -0.5) — well clear of the H wire.
			const v = new Wire(WireDirection.VERTICAL, 5);
			v.position.set(0.5, -5.5);
			project.addWire(v);

			session = new SelectionMoveSession(
				project,
				dragLayer,
				new Set(),
				new Set([v]),
				new Point(0, -1)
			);
			// Move delta = (4, 1) so v ends up at (4.5, -4.5)→(4.5, 0.5).
			// v.end (4.5, 0.5) lands on long's interior.
			session.onMove(makeMoveEvent(4, 0));
			expect(session.canEnd()).toBeTrue();
			session.onEnd();

			const huge = new Rectangle(-100, -100, 200, 200);
			const wires = Array.from(project.queryWiresInRange(huge));

			// long should be replaced by two halves.
			expect(wires.find((w) => w.id === long.id)).toBeUndefined();
			const horizontals = wires.filter(
				(w) => w.direction === WireDirection.HORIZONTAL
			);
			expect(horizontals.length).toBe(2);
			// CP at (4.5, 0.5).
			expect(project.connectionPoints.hasCpAt(new Point(4.5, 0.5))).toBeTrue();
		});

		it('rolls back the tentative cut when the drag ends with no movement', () => {
			const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
			project.addWire(wire);

			project.selectionManager.commit(
				new Rectangle(5, 0, 2, 1),
				WorkMode.SELECT_EXACT
			);

			expect(allWires().length).toBe(3);
			const insidePiece = Array.from(project.selectionManager.selectedWires)[0];

			session = new SelectionMoveSession(
				project,
				dragLayer,
				new Set(),
				new Set([insidePiece]),
				new Point(5, 0)
			);
			// No onMove — delta stays at (0, 0).
			session.onEnd();

			// hasMove was false, so the session returned early without claiming.
			// The pending cut survives.
			expect(project.selectionManager.hasPendingCut).toBeTrue();
			expect(allWires().length).toBe(3);

			// A subsequent clear (e.g., the user clicks empty space) rolls back.
			project.selectionManager.clear();
			expect(project.selectionManager.hasPendingCut).toBeFalse();
			const after = allWires();
			expect(after.length).toBe(1);
			expect(after[0].position.x).toBe(0.5);
			expect(after[0].length).toBe(10);

			// And the undo history is empty — nothing should have been pushed.
			expect(project.actionManager.undoAvailable).toBeFalse();
		});
	});
});
