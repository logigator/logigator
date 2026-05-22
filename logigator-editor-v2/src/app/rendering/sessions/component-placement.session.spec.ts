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
import { ComponentPlacementSession } from './component-placement.session';

// AND gate: bodyGridWidth=2, bodyGridHeight=max(inputs,1)=2 for 2-input gate.
// When dragLayer.position=(px,py): bodyBoundsWorld = Rectangle(px, py, 2, 2).
// gridBounds (with stubs): lx=-0.5, w=3 → Rectangle(px-0.5, py, 3, 2).

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

describe('ComponentPlacementSession collision', () => {
	let project: Project;
	let dragLayer: Container<Component | Wire>;
	let session: ComponentPlacementSession;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
		dragLayer = new Container<Component | Wire>();
		project.componentToPlace = andComponentConfig;
	});

	afterEach(() => {
		session?.onCancel();
		dragLayer.destroy();
		project.destroy({ children: true });
	});

	it('canEnd() is true when placed on empty ground', () => {
		session = new ComponentPlacementSession(project, dragLayer, new Point(0, 0));
		expect(session.canEnd()).toBeTrue();
	});

	it('canEnd() is false when body overlaps an existing component', () => {
		const existing = makeAnd();
		existing.position.set(0, 0);
		project.addComponent(existing);
		session = new ComponentPlacementSession(project, dragLayer, new Point(0, 0));
		expect(session.canEnd()).toBeFalse();
	});

	it('canEnd() is false when body lands on a wire — catches missing wire check bug', () => {
		// Body at startPos=(5,0): Rectangle(5,0,2,2).
		// Wire gx=3, len=3: gridBounds=[3,7)×[0,1) → enters body at x=5.
		const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(wire);
		session = new ComponentPlacementSession(project, dragLayer, new Point(5, 0));
		expect(session.canEnd()).toBeFalse();
		wire.destroy();
	});

	it('canEnd() is true when wire ends at the stub boundary (not inside body)', () => {
		// Body at (5,0): Rectangle(5,0,2,2). Wire gx=0, len=4: gridBounds=[0,5)×[0,1).
		// Wire right=5 equals body left=5 → no intersection (touches but does not overlap).
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		project.addWire(wire);
		session = new ComponentPlacementSession(project, dragLayer, new Point(5, 0));
		expect(session.canEnd()).toBeTrue();
		wire.destroy();
	});

	it('canEnd() clears to true after onMove moves body off the wire', () => {
		const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(wire);
		session = new ComponentPlacementSession(project, dragLayer, new Point(5, 0));
		expect(session.canEnd()).toBeFalse();

		session.onMove(makeMoveEvent(20, 0));
		expect(session.canEnd()).toBeTrue();
		wire.destroy();
	});

	it('canEnd() sets to false after onMove moves body onto a wire', () => {
		const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(wire);
		session = new ComponentPlacementSession(project, dragLayer, new Point(0, 10));
		expect(session.canEnd()).toBeTrue();

		session.onMove(makeMoveEvent(5, 0));
		expect(session.canEnd()).toBeFalse();
		wire.destroy();
	});
});
