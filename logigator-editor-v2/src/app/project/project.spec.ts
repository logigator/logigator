import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { Project } from './project';
import { AndComponent } from '../components/component-types/and/and.component';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';

function makeAnd(numInputs = 2): AndComponent {
	return new AndComponent([
		andComponentConfig.options[0].clone(),
		andComponentConfig.options[1].clone(numInputs)
	]);
}

// Wire at half-grid position (gx+0.5, gy+0.5) with given direction and length
function makeWire(gx: number, gy: number, dir: WireDirection, length: number): Wire {
	const w = new Wire(dir, length);
	w.position.set(gx + 0.5, gy + 0.5);
	return w;
}

describe('Project.hasComponentCollision', () => {
	let project: Project;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	it('returns false for an empty project', () => {
		const bounds = new Rectangle(0, 0, 10, 10);
		expect(project.hasComponentCollision(bounds)).toBeFalse();
	});

	it('detects direct overlap with a placed component', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 3);
		project.addComponent(comp);

		// Query a rect that clearly overlaps the component body
		const query = new Rectangle(3, 3, 1, 1);
		expect(project.hasComponentCollision(query)).toBeTrue();
	});

	it('allows adjacent components whose stubs touch (no collision)', () => {
		// Component A: body width 2 at (0,0), output stub reaches x=2.5
		const compA = makeAnd(2);
		compA.position.set(0, 0);
		project.addComponent(compA);

		// Component B: input stub at x=2.5 when placed at (3,0)
		const compB = makeAnd(2);
		compB.position.set(3, 0);
		// gridBounds of B: x = 3 - 0.5 = 2.5
		expect(project.hasComponentCollision(compB.gridBounds)).toBeFalse();

		compB.destroy({ children: true });
	});

	it('detects stub overlap when components are too close', () => {
		// Component A at (0,0): body width 2, output stub reaches x=2.5
		const compA = makeAnd(2);
		compA.position.set(0, 0);
		project.addComponent(compA);

		// Component B at (2,0): input stub from x=1.5 → overlaps A's output stub (0→2.5)
		const compB = makeAnd(2);
		compB.position.set(2, 0);
		// gridBounds of B: x = 2 - 0.5 = 1.5
		expect(project.hasComponentCollision(compB.gridBounds)).toBeTrue();

		compB.destroy({ children: true });
	});

	it('excludes a component when its id is in excludeIds', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 3);
		project.addComponent(comp);

		const bounds = new Rectangle(3, 3, 1, 1);
		expect(
			project.hasComponentCollision(bounds, new Set([comp.id]))
		).toBeFalse();
	});
});

describe('Project.hasWireBodyCollision', () => {
	let project: Project;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	// Component at (3,0): body [3,5)x[0,2), stubs: input at x=2.5, output at x=5.5
	// (Right-facing, 2 inputs, 1 output, bodyGridWidth=2, bodyGridHeight=2)

	it('wire endpoint exactly at stub tip is not a collision', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 0);
		project.addComponent(comp);

		// Horizontal wire ending at stub tip (2.5, 0.5): pos=(px,0.5), length s.t. end=2.5
		// Wire from x=0.5 length 2 → ends at 2.5
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		// wire.position = (0.5, 0.5), length=2, endpoints (0.5,0.5) and (2.5,0.5)
		expect(project.hasWireBodyCollision(wire.gridBounds)).toBeFalse();
		wire.destroy();
	});

	it('wire entering body is a collision', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 0);
		project.addComponent(comp);

		// Wire from x=0.5 length 3 → ends at (3.5, 0.5), inside body
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		expect(project.hasWireBodyCollision(wire.gridBounds)).toBeTrue();
		wire.destroy();
	});

	it('wire passing through the full body is a collision', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 0);
		project.addComponent(comp);

		// Wire from x=0.5 length 6 → passes through entire body
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
		expect(project.hasWireBodyCollision(wire.gridBounds)).toBeTrue();
		wire.destroy();
	});

	it('vertical wire in stub column does not touch body', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 0);
		project.addComponent(comp);

		// Vertical wire at x=2.5 (input stub column), y span [0.5, 4.5]
		const wire = makeWire(2, 0, WireDirection.VERTICAL, 4);
		expect(project.hasWireBodyCollision(wire.gridBounds)).toBeFalse();
		wire.destroy();
	});

	it('excludeIds exempts a component', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 0);
		project.addComponent(comp);

		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		expect(
			project.hasWireBodyCollision(wire.gridBounds, new Set([comp.id]))
		).toBeFalse();
		wire.destroy();
	});
});

describe('Project.hasComponentBodyWireCollision', () => {
	let project: Project;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	// Body under test: Rectangle(3, 0, 2, 2) — covers x∈[3,5), y∈[0,2)

	it('returns false for an empty project', () => {
		expect(
			project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
		).toBeFalse();
	});

	it('horizontal wire passing through body is a collision', () => {
		// Wire gx=0, len=4: gridBounds=[0,5)×[0,1) — enters body at x=3
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		project.addWire(wire);
		expect(project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))).toBeTrue();
		wire.destroy();
	});

	it('vertical wire passing through body is a collision', () => {
		// Vertical wire at (3,0) len=2: gridBounds=[3,4)×[0,3) — overlaps body
		const wire = makeWire(3, 0, WireDirection.VERTICAL, 2);
		project.addWire(wire);
		expect(project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))).toBeTrue();
		wire.destroy();
	});

	it('wire whose right edge is exactly at the body left boundary is not a collision', () => {
		// Wire gx=0, len=2: gridBounds=[0,3)×[0,1) — right=3 equals body left=3 → no overlap
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		project.addWire(wire);
		expect(project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))).toBeFalse();
		wire.destroy();
	});

	it('wire whose left edge is exactly at the body right boundary is not a collision', () => {
		// Wire gx=5, len=2: gridBounds=[5,8)×[0,1) — left=5 equals body right=5 → no overlap
		const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 2);
		project.addWire(wire);
		expect(project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))).toBeFalse();
		wire.destroy();
	});

	it('excludeIds exempts a wire that would otherwise collide', () => {
		const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		project.addWire(wire);
		expect(
			project.hasComponentBodyWireCollision(
				new Rectangle(3, 0, 2, 2),
				new Set([wire.id])
			)
		).toBeFalse();
		wire.destroy();
	});
});
