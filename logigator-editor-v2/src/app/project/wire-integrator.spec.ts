import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { WireIntegrator } from './wire-integrator';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';

function makeWire(gx: number, gy: number, dir: WireDirection, length: number): Wire {
	const w = new Wire(dir, length);
	w.position.set(gx + 0.5, gy + 0.5);
	return w;
}

function makeQuery(wires: Wire[]): (rect: Rectangle) => Generator<Wire> {
	return function* (rect: Rectangle) {
		for (const w of wires) {
			if (w.gridBounds.intersects(rect)) yield w;
		}
	};
}

describe('WireIntegrator', () => {
	let integrator: WireIntegrator;
	let existing: Wire[];
	const SCALE = 1;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		integrator = new WireIntegrator();
		existing = [];
	});

	afterEach(() => {
		for (const w of existing) w.destroy();
	});

	it('no existing wires — returns new wire unchanged', () => {
		const n = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery([]), SCALE);
		expect(toAdd.length).toBe(1);
		expect(toRemove.length).toBe(0);
		expect(toAdd[0]).toBe(n);
		n.destroy();
	});

	it('partial overlap — merges into one wider wire', () => {
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		existing.push(e);
		const n = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n.destroy();
	});

	it('full containment (new inside existing) — merged wire equals existing span', () => {
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
		existing.push(e);
		const n = makeWire(1, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n.destroy();
	});

	it('adjacent without T-junction — merges', () => {
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		existing.push(e);
		const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		n.destroy();
	});

	it('adjacent with T-junction (perpendicular wire at shared point) — does NOT merge', () => {
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		const vWire = makeWire(3, 0, WireDirection.VERTICAL, 3);
		existing.push(e, vWire);
		const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).not.toContain(e);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('chain merge (first pass) — new wire bridges two collinear segments within initial query range', () => {
		const a = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		const b = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
		existing.push(a, b);
		const n = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(a);
		expect(toRemove).toContain(b);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		n.destroy();
	});

	it('chain merge (while loop) — grows to reach a segment outside the initial query range', () => {
		const a = makeWire(8, 0, WireDirection.HORIZONTAL, 2);
		const b = makeWire(6, 0, WireDirection.HORIZONTAL, 2);
		existing.push(a, b);
		const n = makeWire(10, 0, WireDirection.HORIZONTAL, 1);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(a);
		expect(toRemove).toContain(b);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(5);
		expect(toAdd[0].position.x).toBeCloseTo(6.5, 5);
		n.destroy();
	});

	it('perpendicular wires — no merge', () => {
		const e = makeWire(0, 0, WireDirection.VERTICAL, 4);
		existing.push(e);
		const n = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove.length).toBe(0);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('parallel wires on different axis — no merge', () => {
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		existing.push(e);
		const n = makeWire(0, 2, WireDirection.HORIZONTAL, 4);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove.length).toBe(0);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('two new wires (H+V) — each integrates independently', () => {
		const existH = makeWire(4, 0, WireDirection.HORIZONTAL, 3);
		const existV = makeWire(0, 4, WireDirection.VERTICAL, 3);
		existing.push(existH, existV);
		const nH = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
		const nV = makeWire(0, 0, WireDirection.VERTICAL, 4);
		const { toAdd, toRemove } = integrator.integrate([nH, nV], makeQuery(existing), SCALE);
		expect(toRemove).toContain(existH);
		expect(toRemove).toContain(existV);
		expect(toAdd.length).toBe(2);
		nH.destroy();
		nV.destroy();
	});

	it('second-pass merge — two new wires adjacent to opposite ends of same existing wire', () => {
		const e = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
		existing.push(e);
		const n1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		const n2 = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = integrator.integrate([n1, n2], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toRemove).toContain(n1);
		expect(toRemove).toContain(n2);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
		n1.destroy();
		n2.destroy();
	});

	it('vertical partial overlap — merges into one taller wire', () => {
		const e = makeWire(0, 0, WireDirection.VERTICAL, 3);
		existing.push(e);
		const n = makeWire(0, 2, WireDirection.VERTICAL, 4);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		expect(toAdd[0].position.y).toBeCloseTo(0.5, 5);
		n.destroy();
	});

	it('vertical adjacent without T-junction — merges', () => {
		const e = makeWire(0, 0, WireDirection.VERTICAL, 3);
		existing.push(e);
		const n = makeWire(0, 3, WireDirection.VERTICAL, 3);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).toContain(e);
		expect(toAdd.length).toBe(1);
		expect(toAdd[0].length).toBe(6);
		n.destroy();
	});

	it('vertical adjacent with T-junction — does NOT merge', () => {
		const e = makeWire(0, 0, WireDirection.VERTICAL, 3);
		const hWire = makeWire(0, 3, WireDirection.HORIZONTAL, 3);
		existing.push(e, hWire);
		const n = makeWire(0, 3, WireDirection.VERTICAL, 3);
		const { toAdd, toRemove } = integrator.integrate([n], makeQuery(existing), SCALE);
		expect(toRemove).not.toContain(e);
		expect(toAdd).toContain(n);
		n.destroy();
	});

	it('second-pass merge blocked by T-junction — does NOT merge two new wires', () => {
		// n1 and n2 are adjacent but a perpendicular wire sits at their shared endpoint.
		// n1: [0.5, 2.5), n2: [2.5, 4.5) — adjacent at 2.5
		// No existing collinear wire, so both survive the first pass as-is.
		// The second pass should NOT merge them because a vertical wire sits at x=2.5.
		const vWire = makeWire(2, 0, WireDirection.VERTICAL, 3);
		existing.push(vWire);
		const n1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
		const n2 = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
		const { toAdd, toRemove } = integrator.integrate([n1, n2], makeQuery(existing), SCALE);
		expect(toRemove.length).toBe(0);
		expect(toAdd).toContain(n1);
		expect(toAdd).toContain(n2);
		expect(toAdd.length).toBe(2);
		n1.destroy();
		n2.destroy();
	});

	it('non-unit scale — merged wire has applyScale applied', () => {
		const SCALE2 = 2;
		const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		existing.push(e);
		const n = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
		const { toAdd } = integrator.integrate([n], makeQuery(existing), SCALE2);
		expect(toAdd.length).toBe(1);
		// Wire.applyScale(s) sets scale.y = 1 / (s * gridSize); verify it differs from scale=1 case
		const wireAtScale2 = toAdd[0];
		const wireAtScale1 = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
		wireAtScale1.applyScale(1);
		expect(wireAtScale2.scale.y).not.toBeCloseTo(wireAtScale1.scale.y, 5);
		wireAtScale1.destroy();
		n.destroy();
	});
});
