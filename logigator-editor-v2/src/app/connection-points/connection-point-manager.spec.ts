import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { ConnectionPointManager } from './connection-point-manager';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { Component } from '../components/component';
import { AndComponent } from '../components/component-types/and/and.component';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { Direction } from '../utils/direction';

function makeWire(gx: number, gy: number, dir: WireDirection, length: number): Wire {
	const w = new Wire(dir, length);
	w.position.set(gx + 0.5, gy + 0.5);
	return w;
}

function makeAnd(
	numInputs: number,
	rotation: Direction,
	px = 0,
	py = 0
): AndComponent {
	const comp = new AndComponent([
		andComponentConfig.options[0].clone(rotation),
		andComponentConfig.options[1].clone(numInputs)
	]);
	comp.position.set(px, py);
	return comp;
}

function makeManager(
	wires: Wire[],
	components: Component[] = []
): ConnectionPointManager {
	function* wireQuery(rect: Rectangle): Generator<Wire> {
		for (const w of wires) {
			if (w.gridBounds.intersects(rect)) yield w;
		}
	}
	function* compQuery(rect: Rectangle): Generator<Component> {
		for (const c of components) {
			if (c.gridBounds.intersects(rect)) yield c;
		}
	}
	return new ConnectionPointManager(wireQuery, compQuery, () => 1);
}

const snap = Wire.snapshot;

describe('ConnectionPointManager', () => {
	let wires: Wire[];
	let components: Component[];

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		wires = [];
		components = [];
	});

	afterEach(() => {
		for (const w of wires) if (!w.destroyed) w.destroy();
		for (const c of components) if (!c.destroyed) c.destroy({ children: true });
	});

	// --- Basic wire-only cases ---

	it('single wire endpoint, nothing else — no CP', () => {
		const w = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		wires.push(w);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(w));
		expect(mgr.hasCpAt(w.connectionPoints[0])).toBe(false);
		expect(mgr.hasCpAt(w.connectionPoints[1])).toBe(false);
	});

	it('L-corner: two perpendicular wires share an endpoint — no CP (D=2)', () => {
		// H wire from (0.5,0.5) to (3.5,0.5); V wire from (3.5,0.5) to (3.5,3.5)
		const h = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
		const v = makeWire(3, 0, WireDirection.VERTICAL, 3);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		mgr.onWireAdded(snap(v));
		const jn = new Point(3.5, 0.5);
		expect(mgr.hasCpAt(jn)).toBe(false);
	});

	it('pure crossing (H interior + V interior, no endpoints at P) — no CP (T=0)', () => {
		// H: (0.5,2.5)→(5.5,2.5); V: (2.5,0.5)→(2.5,4.5)
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 4);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		mgr.onWireAdded(snap(v));
		const cross = new Point(2.5, 2.5);
		expect(mgr.hasCpAt(cross)).toBe(false);
	});

	it('2-wire T (V endpoint on H interior) — CP exists (D=3, T=1)', () => {
		// H: (0.5,2.5)→(5.5,2.5); V: (2.5,0.5)→(2.5,2.5) [V ends at P]
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		mgr.onWireAdded(snap(v));
		const jn = new Point(2.5, 2.5);
		expect(mgr.hasCpAt(jn)).toBe(true);
	});

	it('3-wire T (merge-prevented: 2 collinear H endpoints + 1 V endpoint at P) — CP exists', () => {
		// H1: (0.5,2.5)→(2.5,2.5); H2: (2.5,2.5)→(5.5,2.5); V: (2.5,0.5)→(2.5,2.5)
		const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
		const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h1, h2, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h1));
		mgr.onWireAdded(snap(h2));
		mgr.onWireAdded(snap(v));
		const jn = new Point(2.5, 2.5);
		expect(mgr.hasCpAt(jn)).toBe(true);
	});

	it('4-wire X (all four endpoints at P) — CP exists', () => {
		// Four wires meeting at (2.5, 2.5)
		const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
		const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 2);
		const v1 = makeWire(2, 0, WireDirection.VERTICAL, 2);
		const v2 = makeWire(2, 2, WireDirection.VERTICAL, 2);
		wires.push(h1, h2, v1, v2);
		const mgr = makeManager(wires);
		for (const w of wires) mgr.onWireAdded(snap(w));
		const jn = new Point(2.5, 2.5);
		expect(mgr.hasCpAt(jn)).toBe(true);
	});

	// --- Component-only and wire+component cases ---

	it('port-only at P, no wires — no CP (D=1)', () => {
		const comp = makeAnd(2, Direction.E, 0, 0);
		components.push(comp);
		const mgr = makeManager(wires, components);
		mgr.onComponentAdded(comp.connectionPoints);
		// Input port tip at (-0.5, 0.5) — just one direction from stub, T=1 but D=1
		const tip = comp.connectionPoints[0];
		expect(mgr.hasCpAt(tip)).toBe(false);
	});

	it('port + one wire endpoint — no CP (D=2)', () => {
		const comp = makeAnd(1, Direction.E, 0, 0);
		components.push(comp);
		const portTip = comp.connectionPoints[0]; // (-0.5, 0.5)
		// We want a horizontal wire whose END is at portTip (-0.5, 0.5):
		//   end = pos.x + length => -0.5 = pos.x + 3 => pos.x = -3.5
		const wireToPort = new Wire(WireDirection.HORIZONTAL, 3);
		wireToPort.position.set(-3.5, 0.5);
		wires.push(wireToPort);
		const mgr = makeManager(wires, components);
		mgr.onComponentAdded(comp.connectionPoints);
		mgr.onWireAdded(snap(wireToPort));
		expect(mgr.hasCpAt(portTip)).toBe(false);
	});

	it('port + two wire endpoints at port tip — CP exists (D=3)', () => {
		const comp = makeAnd(1, Direction.E, 0, 0);
		components.push(comp);
		const portTip = comp.connectionPoints[0]; // (-0.5, 0.5)
		// Two wires ending at portTip (both H wires on same row — the one from E and one from W)
		// Wire 1 ending at (-0.5, 0.5): pos=(-3.5, 0.5), length=3
		const w1 = new Wire(WireDirection.HORIZONTAL, 3);
		w1.position.set(-3.5, 0.5);
		// Wire 2 starting at (-0.5, 0.5): but direction H, start = pos, so pos=(-0.5, 0.5), length=3
		// Two H wires from the same side don't give D>=3 (both add E or both add W)
		// Instead: wire from below (V) ending at (-0.5, 0.5):
		//   vertical: end = pos + length; need end.y=0.5, so pos.y + length = 0.5
		//   pos=(-0.5, -2.5), length=3 → end=(-0.5, 0.5) ✓
		const w2 = new Wire(WireDirection.VERTICAL, 3);
		w2.position.set(-0.5, -2.5);
		wires.push(w1, w2);
		const mgr = makeManager(wires, components);
		mgr.onComponentAdded(comp.connectionPoints);
		mgr.onWireAdded(snap(w1));
		mgr.onWireAdded(snap(w2));
		// D = E(stub back toward body) + W(w1 end) + N(w2 end) = 3, T = port + w1 end + w2 end = 3
		expect(mgr.hasCpAt(portTip)).toBe(true);
	});

	it('wire interior (vertical) crossing a Right-component output port — CP exists', () => {
		// Right component at (0, 0): output port tip at (2.5, 0.5)
		const comp = makeAnd(2, Direction.E, 0, 0);
		components.push(comp);
		const outputTip = comp.connectionPoints[2]; // output at (2.5, 0.5)
		// Vertical wire whose interior passes through (2.5, 0.5):
		// pos=(2.5, -2.5), length=5 → interior includes (2.5, 0.5) ✓
		const vWire = new Wire(WireDirection.VERTICAL, 5);
		vWire.position.set(2.5, -2.5);
		wires.push(vWire);
		const mgr = makeManager(wires, components);
		mgr.onComponentAdded(comp.connectionPoints);
		mgr.onWireAdded(snap(vWire));
		// stub for Right output = W; wire interior fills N+S → D = {W, N, S} = 3, T = 1 (port) → CP
		expect(mgr.hasCpAt(outputTip)).toBe(true);
	});

	// --- Manager lifecycle tests ---

	it('onWireAdded creates CP at a new junction', () => {
		// T-junction: H wire + V wire ending on H interior.
		// Push wires incrementally so the query lambda reflects each step.
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(false);
		wires.push(v);
		mgr.onWireAdded(snap(v));
		expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
	});

	it('onWireRemoved destroys CP when rule no longer satisfied', () => {
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		mgr.onWireAdded(snap(v));
		expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);

		// Remove V wire: T-junction disappears
		const vSnap = snap(v);
		wires.splice(wires.indexOf(v), 1);
		const mgr3 = makeManager(wires);
		mgr3.onWireAdded(snap(h));
		mgr3.onWireRemoved(vSnap);
		expect(mgr3.hasCpAt(new Point(2.5, 2.5))).toBe(false);
	});

	it('recomputeAt is idempotent — calling twice produces exactly one CP', () => {
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.onWireAdded(snap(h));
		mgr.onWireAdded(snap(v));
		const p = new Point(2.5, 2.5);
		expect(mgr.hasCpAt(p)).toBe(true);
		mgr.recomputeAt(p);
		mgr.recomputeAt(p);
		// Only one CP at p — count via layer children at that position
		const cpsAtP = mgr.layer.children.filter(
			(cp) => cp.position.x === p.x && cp.position.y === p.y
		);
		expect(cpsAtP.length).toBe(1);
	});

	it('recomputeAll rebuilds all expected CPs from scratch', () => {
		// Two T-junctions in one scene
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 7);
		const v1 = makeWire(2, 0, WireDirection.VERTICAL, 2);
		const v2 = makeWire(5, 0, WireDirection.VERTICAL, 2);
		wires.push(h, v1, v2);
		const mgr = makeManager(wires);
		mgr.recomputeAll(wires, components);
		expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
		expect(mgr.hasCpAt(new Point(5.5, 2.5))).toBe(true);
	});

	it('recomputeAll destroys old CPs before rebuilding — no leaked Graphics', () => {
		const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
		const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
		wires.push(h, v);
		const mgr = makeManager(wires);
		mgr.recomputeAll(wires, components);
		const childCountBefore = mgr.layer.children.length;

		// Remove the V wire and force a rebuild on the original manager.
		wires.splice(wires.indexOf(v), 1);
		mgr.recomputeAll(wires, components);
		const childCountAfter = mgr.layer.children.length;

		expect(childCountBefore).toBeGreaterThan(0);
		expect(childCountAfter).toBe(0);
	});

	it('affectedPointsForWire returns wire endpoints + endpoints of other wires on segment', () => {
		// H wire from (0.5,0.5) to (5.5,0.5)
		// V wire with endpoint at (3.5, 0.5) — lies on H wire segment
		const h = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
		const v = makeWire(3, 0, WireDirection.VERTICAL, 3); // start at (3.5, 0.5)
		wires.push(h, v);
		const mgr = makeManager(wires);
		const points = [...mgr.affectedPointsForWire(h)];
		const hasStart = points.some((p) => p.x === 0.5 && p.y === 0.5);
		const hasEnd = points.some((p) => p.x === 5.5 && p.y === 0.5);
		const hasVStart = points.some((p) => p.x === 3.5 && p.y === 0.5);
		expect(hasStart).toBe(true);
		expect(hasEnd).toBe(true);
		expect(hasVStart).toBe(true);
	});

	it('affectedPointsForSnapshot matches affectedPointsForWire for same wire', () => {
		const h = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
		const v = makeWire(3, 0, WireDirection.VERTICAL, 3);
		wires.push(h, v);
		const mgr = makeManager(wires);
		const fromWire = [...mgr.affectedPointsForWire(h)];
		const fromSnap = [...mgr.affectedPointsForSnapshot(snap(h))];

		// Same set of keys
		const toKey = (p: Point) => `${p.x},${p.y}`;
		const wireKeys = new Set(fromWire.map(toKey));
		const snapKeys = new Set(fromSnap.map(toKey));
		expect(wireKeys.size).toBe(snapKeys.size);
		for (const k of wireKeys) expect(snapKeys.has(k)).toBe(true);
	});

	// --- Component portStubs direction lookup ---

	it('portStubs reports correct cardinal for Right rotation', () => {
		const comp = makeAnd(2, Direction.E, 0, 0);
		components.push(comp);
		const stubs = comp.portStubs;
		// inputs: stub direction E (back toward body for Right-facing component)
		expect(stubs[0].direction).toBe(Direction.E);
		expect(stubs[1].direction).toBe(Direction.E);
		// output: stub direction W
		expect(stubs[2].direction).toBe(Direction.W);
	});

	it('portStubs reports correct cardinal for Down rotation', () => {
		const comp = makeAnd(2, Direction.S, 0, 0);
		components.push(comp);
		const stubs = comp.portStubs;
		expect(stubs[0].direction).toBe(Direction.S);
		expect(stubs[1].direction).toBe(Direction.S);
		expect(stubs[2].direction).toBe(Direction.N);
	});

	it('portStubs reports correct cardinal for Left rotation', () => {
		const comp = makeAnd(2, Direction.W, 0, 0);
		components.push(comp);
		const stubs = comp.portStubs;
		expect(stubs[0].direction).toBe(Direction.W);
		expect(stubs[1].direction).toBe(Direction.W);
		expect(stubs[2].direction).toBe(Direction.E);
	});

	it('portStubs reports correct cardinal for Up rotation', () => {
		const comp = makeAnd(2, Direction.N, 0, 0);
		components.push(comp);
		const stubs = comp.portStubs;
		expect(stubs[0].direction).toBe(Direction.N);
		expect(stubs[1].direction).toBe(Direction.N);
		expect(stubs[2].direction).toBe(Direction.S);
	});
});
