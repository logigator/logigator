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

describe('Project.computeWireIntegration', () => {
	let project: Project;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	it('no existing wires — returns new wire unchanged', () => {
		const n = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);
		expect(toAdd.length).toBe(1);
		expect(toRemove.length).toBe(0);
		expect(toAdd[0]).toBe(n);
		n.destroy();
	});

	it('partial overlap — merges into one wider wire', () => {
		const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(existing);

		// New wire overlaps from x=2.5 to x=6.5 (length=4)
		const n = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).toContain(existing);
		expect(toAdd.length).toBe(1);
		// Merged span: start=0.5, end=6.5 → length=6
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n.destroy();
	});

	it('full containment (new inside existing) — merged wire equals existing span', () => {
		const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
		project.addWire(existing);

		const n = makeWire(1, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).toContain(existing);
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n.destroy();
	});

	it('adjacent without T-junction — merges', () => {
		const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(existing);

		// New wire starts exactly where existing ends: existing end = (3.5,0.5), new start = (3.5,0.5)?
		// existing pos=(0.5,0.5) len=3 → end at (3.5,0.5)
		// new wire: pos=(3.5,0.5)=gx=3, but makeWire does gx+0.5, so gx=3 → pos=(3.5,0.5)
		const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).toContain(existing);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		n.destroy();
	});

	it('adjacent with T-junction (perpendicular wire at shared point) — does NOT merge', () => {
		const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		project.addWire(existing);

		// Vertical wire at the adjacency point (3.5, 0.5)
		const vWire = makeWire(3, 0, WireDirection.VERTICAL, 3);
		project.addWire(vWire);

		const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).not.toContain(existing);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('chain merge (first pass) — new wire bridges two collinear segments within initial query range', () => {
		// a: [0.5, 2.5), b: [4.5, 6.5), n: [2.5, 4.5) — all within n's initial query rect
		const a = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		const b = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
		project.addWire(a);
		project.addWire(b);

		const n = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).toContain(a);
		expect(toRemove).toContain(b);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		n.destroy();
	});

	it('chain merge (while loop) — grows to reach a segment outside the initial query range', () => {
		// n: [10.5, 11.5) length=1
		// a: [8.5, 10.5) length=2 — adjacent to n at 10.5, within initial query
		// b: [6.5, 8.5) length=2 — adjacent to a at 8.5, NOT in n's initial query rect
		// After merging a, segStart grows to 8.5 and b comes into range on the next iteration.
		const a = makeWire(8, 0, WireDirection.HORIZONTAL, 2); // pos=(8.5,0.5), end=10.5
		const b = makeWire(6, 0, WireDirection.HORIZONTAL, 2); // pos=(6.5,0.5), end=8.5
		project.addWire(a);
		project.addWire(b);

		const n = makeWire(10, 0, WireDirection.HORIZONTAL, 1); // pos=(10.5,0.5), end=11.5
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove).toContain(a);
		expect(toRemove).toContain(b);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(5); // 6.5 → 11.5
		expect(toAdd[0].position.x).toBeCloseTo(6.5, 5);
		n.destroy();
	});

	it('perpendicular wires — no merge', () => {
		const existing = makeWire(0, 0, WireDirection.VERTICAL, 4);
		project.addWire(existing);

		const n = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove.length).toBe(0);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('parallel wires on different axis — no merge', () => {
		const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		project.addWire(existing);

		// Same direction but different y
		const n = makeWire(0, 2, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = project.computeWireIntegration([n]);

		expect(toRemove.length).toBe(0);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('two new wires (H+V) — each integrates independently', () => {
		const existH = makeWire(4, 0, WireDirection.HORIZONTAL, 3);
		const existV = makeWire(0, 4, WireDirection.VERTICAL, 3);
		project.addWire(existH);
		project.addWire(existV);

		const nH = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		const nV = makeWire(0, 0, WireDirection.VERTICAL, 4);
		const { toAdd, toRemove } = project.computeWireIntegration([nH, nV]);

		expect(toRemove).toContain(existH);
		expect(toRemove).toContain(existV);
		expect(toAdd.length).toBe(2);
		nH.destroy();
		nV.destroy();
	});

	it('second-pass merge — two new wires adjacent to opposite ends of same existing wire', () => {
		// e: [2.5, 4.5), n1: [0.5, 2.5) adjacent at 2.5, n2: [4.5, 6.5) adjacent at 4.5
		// n1 consumes e in the first pass; n2 then merges with the n1+e result in the second pass.
		const e = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
		project.addWire(e);

		const n1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		const n2 = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = project.computeWireIntegration([n1, n2]);

		expect(toRemove).toContain(e);
		expect(toRemove).toContain(n1);
		expect(toRemove).toContain(n2);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6); // 0.5 → 6.5
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n1.destroy();
		n2.destroy();
	});
});
