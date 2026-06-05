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

function makeAnd(
  numInputs: number,
  rotation: Direction,
  px = 0,
  py = 0
): AndComponent {
  const comp = new AndComponent({
    direction: andComponentConfig.options.direction.clone(rotation),
    numInputs: andComponentConfig.options.numInputs.clone(numInputs)
  });
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

  // --- Termination-count rule ---

  it('single wire endpoint, nothing else — no CP', () => {
    const w = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    wires.push(w);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(w));
    expect(mgr.hasCpAt(w.connectionPoints[0])).toBe(false);
    expect(mgr.hasCpAt(w.connectionPoints[1])).toBe(false);
  });

  it('L-corner: two perpendicular wires share an endpoint — no CP (T=2)', () => {
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const v = makeWire(3, 0, WireDirection.VERTICAL, 3);
    wires.push(h, v);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h));
    mgr.onWireAdded(snap(v));
    expect(mgr.hasCpAt(new Point(3.5, 0.5))).toBe(false);
  });

  it('pure crossing (H interior + V interior, no endpoints at P) — no CP (T=0)', () => {
    const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 4);
    wires.push(h, v);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h));
    mgr.onWireAdded(snap(v));
    // Interior-on-interior is allowed and does not form a CP under the new rule.
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(false);
  });

  it('3-wire T (2 collinear H endpoints + 1 V endpoint at P) — CP exists', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    wires.push(h1, h2, v);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h1));
    mgr.onWireAdded(snap(h2));
    mgr.onWireAdded(snap(v));
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
  });

  it('4-wire X (all four endpoints at P) — CP exists', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 2);
    const v1 = makeWire(2, 0, WireDirection.VERTICAL, 2);
    const v2 = makeWire(2, 2, WireDirection.VERTICAL, 2);
    wires.push(h1, h2, v1, v2);
    const mgr = makeManager(wires);
    for (const w of wires) mgr.onWireAdded(snap(w));
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
  });

  it('port-only at P, no wires — no CP', () => {
    const comp = makeAnd(2, Direction.E, 0, 0);
    components.push(comp);
    const mgr = makeManager(wires, components);
    mgr.onComponentAdded(comp.connectionPoints);
    const tip = comp.connectionPoints[0];
    expect(mgr.hasCpAt(tip)).toBe(false);
  });

  it('port + one wire endpoint — no CP (T=2)', () => {
    const comp = makeAnd(1, Direction.E, 0, 0);
    components.push(comp);
    const portTip = comp.connectionPoints[0]; // (-0.5, 0.5)
    const wireToPort = new Wire(WireDirection.HORIZONTAL, 3);
    wireToPort.position.set(-3.5, 0.5);
    wires.push(wireToPort);
    const mgr = makeManager(wires, components);
    mgr.onComponentAdded(comp.connectionPoints);
    mgr.onWireAdded(snap(wireToPort));
    expect(mgr.hasCpAt(portTip)).toBe(false);
  });

  it('port + two wire endpoints at port tip — CP exists (T=3)', () => {
    const comp = makeAnd(1, Direction.E, 0, 0);
    components.push(comp);
    const portTip = comp.connectionPoints[0]; // (-0.5, 0.5)
    const w1 = new Wire(WireDirection.HORIZONTAL, 3);
    w1.position.set(-3.5, 0.5); // end at (-0.5, 0.5)
    const w2 = new Wire(WireDirection.VERTICAL, 3);
    w2.position.set(-0.5, -2.5); // end at (-0.5, 0.5)
    wires.push(w1, w2);
    const mgr = makeManager(wires, components);
    mgr.onComponentAdded(comp.connectionPoints);
    mgr.onWireAdded(snap(w1));
    mgr.onWireAdded(snap(w2));
    expect(mgr.hasCpAt(portTip)).toBe(true);
  });

  // --- Lifecycle / hooks ---

  it('onWireAdded creates CP when terminations reach 3', () => {
    // 3-wire T: two collinear H halves + one V endpoint at the meeting point.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    wires.push(h1, h2);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h1));
    mgr.onWireAdded(snap(h2));
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(false);
    wires.push(v);
    mgr.onWireAdded(snap(v));
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
  });

  it('onWireRemoved destroys CP when terminations drop below 3', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    wires.push(h1, h2, v);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h1));
    mgr.onWireAdded(snap(h2));
    mgr.onWireAdded(snap(v));
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);

    const vSnap = snap(v);
    wires.splice(wires.indexOf(v), 1);
    mgr.onWireRemoved(vSnap);
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(false);
  });

  it('recomputeAt is idempotent — calling twice produces exactly one CP', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    wires.push(h1, h2, v);
    const mgr = makeManager(wires);
    mgr.onWireAdded(snap(h1));
    mgr.onWireAdded(snap(h2));
    mgr.onWireAdded(snap(v));
    const p = new Point(2.5, 2.5);
    expect(mgr.hasCpAt(p)).toBe(true);
    mgr.recomputeAt(p);
    mgr.recomputeAt(p);
    const cpsAtP = mgr.layer.children.filter(
      (cp) => cp.position.x === p.x && cp.position.y === p.y
    );
    expect(cpsAtP.length).toBe(1);
  });

  it('recomputeAll rebuilds all expected CPs from scratch', () => {
    // Two 3-wire Ts in one scene.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v1 = makeWire(2, 0, WireDirection.VERTICAL, 2);

    const h3 = makeWire(5, 2, WireDirection.HORIZONTAL, 2);
    const h4 = makeWire(7, 2, WireDirection.HORIZONTAL, 2);
    const v2 = makeWire(7, 0, WireDirection.VERTICAL, 2);

    wires.push(h1, h2, v1, h3, h4, v2);
    const mgr = makeManager(wires);
    mgr.recomputeAll(wires, components);
    expect(mgr.hasCpAt(new Point(2.5, 2.5))).toBe(true);
    expect(mgr.hasCpAt(new Point(7.5, 2.5))).toBe(true);
  });

  it('recomputeAll destroys old CPs before rebuilding', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    wires.push(h1, h2, v);
    const mgr = makeManager(wires);
    mgr.recomputeAll(wires, components);
    const before = mgr.layer.children.length;

    wires.splice(wires.indexOf(v), 1);
    mgr.recomputeAll(wires, components);
    const after = mgr.layer.children.length;

    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
  });

  it('affectedPointsForWire returns just the wire endpoints', () => {
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
    wires.push(h);
    const mgr = makeManager(wires);
    const points = [...mgr.affectedPointsForWire(h)];
    expect(points.length).toBe(2);
    const hasStart = points.some((p) => p.x === 0.5 && p.y === 0.5);
    const hasEnd = points.some((p) => p.x === 5.5 && p.y === 0.5);
    expect(hasStart).toBe(true);
    expect(hasEnd).toBe(true);
  });

  it('affectedPointsForSnapshot returns just the snapshot endpoints', () => {
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
    wires.push(h);
    const mgr = makeManager(wires);
    const points = [...mgr.affectedPointsForSnapshot(snap(h))];
    expect(points.length).toBe(2);
  });
});
