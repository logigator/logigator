import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { WireIntegrator } from './wire-integrator';
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

function makeWireQuery(wires: Wire[]): (rect: Rectangle) => Generator<Wire> {
  return function* (rect: Rectangle) {
    for (const w of wires) {
      if (!w.destroyed && w.gridBounds.intersects(rect)) yield w;
    }
  };
}

function makeComponentQuery(
  components: Component[]
): (rect: Rectangle) => Generator<Component> {
  return function* (rect: Rectangle) {
    for (const c of components) {
      if (!c.destroyed && c.gridBounds.intersects(rect)) yield c;
    }
  };
}

describe('WireIntegrator', () => {
  let integrator: WireIntegrator;
  let existing: Wire[];
  let components: Component[];
  const SCALE = 1;
  const noComponentsQuery: (rect: Rectangle) => Generator<Component> =
    // eslint-disable-next-line require-yield
    function* () {
      return;
    };

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    integrator = new WireIntegrator();
    existing = [];
    components = [];
  });

  afterEach(() => {
    for (const w of existing) if (!w.destroyed) w.destroy();
    for (const c of components) if (!c.destroyed) c.destroy({ children: true });
  });

  // --- Merge cases (existing behavior) ---

  it('no existing wires — returns added wire unchanged', () => {
    const n = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery([]),
      noComponentsQuery,
      SCALE
    );
    expect(toAdd.length).toBe(1);
    expect(toAdd[0]).toBe(n);
    expect(toRemove.length).toBe(0);
    n.destroy();
  });

  it('partial overlap with existing → merges into one wider wire', () => {
    const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    existing.push(e);
    const n = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(e);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
    expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
    n.destroy();
  });

  it('adjacent without T-junction → merges', () => {
    const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    existing.push(e);
    const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(e);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
    n.destroy();
  });

  it('adjacent with perpendicular T-junction blocker → does NOT merge', () => {
    const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const vWire = makeWire(3, 0, WireDirection.VERTICAL, 3);
    existing.push(e, vWire);
    const n = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).not.toContain(e);
    expect(toAdd).toContain(n);
    n.destroy();
  });

  it('component port at the shared endpoint blocks merge', () => {
    // Component port at (3.5, 0.5): AND at (4,0) facing East → input port at (3.5, 0.5).
    const comp = makeAnd(2, Direction.E, 4, 0);
    components.push(comp);
    // A (0.5,0.5)→(3.5,0.5) and B (3.5,0.5)→(6.5,0.5).
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const b = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    existing.push(a, b);
    // Remove a perpendicular blocker D to trigger merge consideration at (3.5, 0.5).
    const d = new Wire(WireDirection.VERTICAL, 2);
    d.position.set(3.5, -1.5); // ends at (3.5, 0.5)
    existing.push(d);
    const { toRemove } = integrator.integrate(
      { removedWires: [d] },
      makeWireQuery(existing),
      makeComponentQuery(components),
      SCALE
    );
    // Port at (3.5, 0.5) still blocks A+B merge.
    expect(toRemove).toContain(d);
    expect(toRemove).not.toContain(a);
    expect(toRemove).not.toContain(b);
  });

  it('chain merge — new wire bridges two collinear segments', () => {
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    const b = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
    existing.push(a, b);
    const n = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
    n.destroy();
  });

  it('chain merge over multiple gaps', () => {
    const a = makeWire(8, 0, WireDirection.HORIZONTAL, 2);
    const b = makeWire(6, 0, WireDirection.HORIZONTAL, 2);
    existing.push(a, b);
    const n = makeWire(10, 0, WireDirection.HORIZONTAL, 1);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
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
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
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
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [nH, nV] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(existH);
    expect(toRemove).toContain(existV);
    expect(toAdd.length).toBe(2);
    nH.destroy();
    nV.destroy();
  });

  it('two new wires adjacent to opposite ends of same existing wire — full merge', () => {
    const e = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
    existing.push(e);
    const n1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    const n2 = makeWire(4, 0, WireDirection.HORIZONTAL, 2);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n1, n2] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(e);
    // n1 and n2 were addedWires; under new semantics they don't appear in toRemove.
    expect(toRemove).not.toContain(n1);
    expect(toRemove).not.toContain(n2);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
    expect(toAdd[0].position.x).toBeCloseTo(0.5, 5);
    n1.destroy();
    n2.destroy();
  });

  it('two new wires adjacent with perpendicular T-blocker — does NOT merge them', () => {
    const vWire = makeWire(2, 0, WireDirection.VERTICAL, 3);
    existing.push(vWire);
    const n1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    const n2 = makeWire(2, 0, WireDirection.HORIZONTAL, 2);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n1, n2] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove.length).toBe(0);
    expect(toAdd).toContain(n1);
    expect(toAdd).toContain(n2);
    expect(toAdd.length).toBe(2);
    n1.destroy();
    n2.destroy();
  });

  // --- Split cases (new behavior) ---

  it('new wire endpoint lands on existing wire interior → splits existing', () => {
    // Existing H wire (0.5,0.5)→(6.5,0.5); new V wire endpoint at (3.5, 0.5).
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    existing.push(h);
    // V wire ending at (3.5, 0.5): pos.y + length = 0.5; pos=(3.5, -2.5), length=3.
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(3.5, -2.5);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [v] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h);
    // Two split halves of h plus the original v.
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(2);
    expect(toAdd).toContain(v);
    const lengths = horizontals.map((w) => w.length).sort();
    expect(lengths).toEqual([3, 3]);
    v.destroy();
  });

  it('new wire interior contains existing endpoint → splits new wire', () => {
    // Existing V wire endpoint at (3.5, 0.5).
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(3.5, -2.5);
    existing.push(v);
    // New H wire (0.5,0.5)→(6.5,0.5), interior contains (3.5, 0.5).
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [h] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    // v stays in the tree.
    expect(toRemove).not.toContain(v);
    // h was split — it should NOT be in toAdd; two halves should be.
    expect(toAdd).not.toContain(h);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(2);
    const lengths = horizontals.map((w) => w.length).sort();
    expect(lengths).toEqual([3, 3]);
    h.destroy();
  });

  it('new wire interior crosses a component port → splits new wire', () => {
    // AndComponent facing E with 2 inputs at (4,0) has input ports at (3.5, 0.5) and (3.5, 1.5)
    // and an output port at (4 + 2, 0.5) = (6, 0.5)... actually let me re-derive:
    // bodyGridWidth = 2; bodyGridBounds.x = position.x; right = x + 2.
    // Input port (E, i=0): apply matrix(rot=0) to (-0.5, 0.5) → (-0.5, 0.5); + position.
    //   pos = (4, 0): port = (3.5, 0.5).
    // We want a port at (3.5, 0.5) inside an H wire (0.5,0.5)→(6.5,0.5).
    const comp = makeAnd(2, Direction.E, 4, 0);
    components.push(comp);
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [h] },
      makeWireQuery(existing),
      makeComponentQuery(components),
      SCALE
    );
    expect(toRemove.length).toBe(0);
    expect(toAdd).not.toContain(h);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    // Port at (3.5, 0.5) splits h once → 2 halves.
    // Port at (3.5, 1.5) is NOT on h (different y).
    expect(horizontals.length).toBe(2);
    h.destroy();
  });

  it('new wire interior crosses multiple existing endpoints → multiple splits', () => {
    // Two vertical wires ending at (3.5, 0.5) and (5.5, 0.5); new H wire (0.5,0.5)→(7.5,0.5).
    const v1 = new Wire(WireDirection.VERTICAL, 3);
    v1.position.set(3.5, -2.5);
    const v2 = new Wire(WireDirection.VERTICAL, 3);
    v2.position.set(5.5, -2.5);
    existing.push(v1, v2);
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 7);
    const { toAdd } = integrator.integrate(
      { addedWires: [h] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(3);
    const lengths = horizontals.map((w) => w.length).sort();
    expect(lengths).toEqual([2, 2, 3]);
    h.destroy();
  });

  // --- Re-merge cases (new behavior) ---

  it('wire removed leaves merge-able collinear neighbors → merge', () => {
    // A (0.5,2.5)→(3.5,2.5), B (3.5,2.5)→(6.5,2.5), V endpoint at (3.5, 2.5) blocking merge.
    const a = makeWire(0, 2, WireDirection.HORIZONTAL, 3);
    const b = makeWire(3, 2, WireDirection.HORIZONTAL, 3);
    const v = new Wire(WireDirection.VERTICAL, 2);
    v.position.set(3.5, 2.5); // start at (3.5, 2.5)
    existing.push(a, b, v);
    const { toAdd, toRemove } = integrator.integrate(
      { removedWires: [v] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(v);
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
  });

  it('component port removed leaves merge-able collinear neighbors → merge', () => {
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 3); // ends at (3.5, 0.5)
    const b = makeWire(3, 0, WireDirection.HORIZONTAL, 3); // starts at (3.5, 0.5)
    existing.push(a, b);
    // Removed component port at (3.5, 0.5).
    const { toAdd, toRemove } = integrator.integrate(
      { removedComponentPorts: [new Point(3.5, 0.5)] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
  });

  it('isolated wire removed leaves nothing to merge', () => {
    const lonely = makeWire(3, 5, WireDirection.HORIZONTAL, 4);
    existing.push(lonely);
    const { toAdd, toRemove } = integrator.integrate(
      { removedWires: [lonely] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toAdd.length).toBe(0);
    expect(toRemove).toEqual([lonely]);
  });

  // --- Move cases (new behavior) ---

  it('moved wire endpoint lands on existing wire interior → splits existing', () => {
    // Existing horizontal wire (0.5, 0.5)→(6.5, 0.5).
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    // Moved vertical wire now ends at (3.5, 0.5) — was elsewhere previously.
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(3.5, -2.5);
    existing.push(h, v);
    const oldSnapshot = {
      start: new Point(10.5, 10.5),
      end: new Point(10.5, 13.5),
      direction: WireDirection.VERTICAL,
      gridBounds: new Rectangle(10, 10, 1, 4)
    };
    const { toAdd, toRemove } = integrator.integrate(
      { movedWires: [{ wire: v, oldSnapshot }] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h);
    expect(toRemove).not.toContain(v);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(2);
  });

  it('moved wire vacates old position, leaving merge-able neighbors', () => {
    // A (0.5,0.5)→(3.5,0.5), B (3.5,0.5)→(6.5,0.5), V was at (3.5, 0.5) and moved away.
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const b = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    // V is now at a different location — far away.
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(20.5, 20.5);
    existing.push(a, b, v);
    const oldSnapshot = {
      start: new Point(3.5, 0.5),
      end: new Point(3.5, 3.5),
      direction: WireDirection.VERTICAL,
      gridBounds: new Rectangle(3, 0, 1, 4)
    };
    const { toAdd, toRemove } = integrator.integrate(
      { movedWires: [{ wire: v, oldSnapshot }] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    // A and B should merge now.
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    const merged = toAdd.find(
      (w) => w.direction === WireDirection.HORIZONTAL && w.length === 6
    );
    expect(merged).toBeTruthy();
  });

  // --- Cascading cases ---

  it('cascading split — added wire crosses two endpoints', () => {
    const v1 = new Wire(WireDirection.VERTICAL, 3);
    v1.position.set(3.5, -2.5);
    const v2 = new Wire(WireDirection.VERTICAL, 3);
    v2.position.set(5.5, -2.5);
    existing.push(v1, v2);
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 7);
    const { toAdd } = integrator.integrate(
      { addedWires: [h] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(3);
    h.destroy();
  });

  it('cascading merge — removing wires unblocks chain of merges', () => {
    // A (0.5,2.5)→(2.5,2.5), B (2.5,2.5)→(4.5,2.5), C (4.5,2.5)→(6.5,2.5).
    // D vertical at (2.5,2.5), E vertical at (4.5,2.5). Remove D and E.
    const a = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const b = makeWire(2, 2, WireDirection.HORIZONTAL, 2);
    const c = makeWire(4, 2, WireDirection.HORIZONTAL, 2);
    const d = new Wire(WireDirection.VERTICAL, 2);
    d.position.set(2.5, 2.5);
    const e = new Wire(WireDirection.VERTICAL, 2);
    e.position.set(4.5, 2.5);
    existing.push(a, b, c, d, e);
    const { toAdd, toRemove } = integrator.integrate(
      { removedWires: [d, e] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    expect(toRemove).toContain(c);
    expect(toRemove).toContain(d);
    expect(toRemove).toContain(e);
    // One unified wire spanning (0.5,2.5)→(6.5,2.5).
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(1);
    expect(horizontals[0].length).toBe(6);
  });

  // --- Other cases ---

  it('zero-length wire is ignored', () => {
    const n = new Wire(WireDirection.HORIZONTAL);
    n.length = 0;
    n.position.set(0.5, 0.5);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery([]),
      noComponentsQuery,
      SCALE
    );
    expect(toAdd.length).toBe(0);
    expect(toRemove.length).toBe(0);
    n.destroy();
  });

  it('non-unit scale propagates through merged wire', () => {
    const SCALE2 = 2;
    const e = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    existing.push(e);
    const n = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
    const { toAdd } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE2
    );
    expect(toAdd.length).toBe(1);
    const wireAtScale2 = toAdd[0];
    const wireAtScale1 = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    wireAtScale1.applyScale(1);
    expect(wireAtScale2.scale.y).not.toBeCloseTo(wireAtScale1.scale.y, 5);
    wireAtScale1.destroy();
    n.destroy();
  });

  it('vertical analogue: partial overlap merges', () => {
    const e = makeWire(0, 0, WireDirection.VERTICAL, 3);
    existing.push(e);
    const n = makeWire(0, 2, WireDirection.VERTICAL, 4);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(e);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
    n.destroy();
  });
});
