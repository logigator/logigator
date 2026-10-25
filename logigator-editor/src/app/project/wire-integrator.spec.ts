import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { WireIntegrator } from './wire-integrator';
import { Wire } from '../wires/wire';
import { Direction, WireDirection } from '@logigator/core';
import { Component } from '../components/component';
import { makeAnd, makeWire } from '../../testing/factories';

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

  // --- Merge cases ---

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
    // AND at (4,0) facing East → input port at (3.5, 0.5).
    const comp = makeAnd(2, Direction.E, 4, 0);
    components.push(comp);
    // A (0.5,0.5)→(3.5,0.5) and B (3.5,0.5)→(6.5,0.5).
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const b = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    existing.push(a, b);
    // Removing the perpendicular blocker D triggers merge consideration.
    const d = new Wire(WireDirection.VERTICAL, 2);
    d.position.set(3.5, -1.5); // ends at (3.5, 0.5)
    existing.push(d);
    const { toRemove } = integrator.integrate(
      { removedWires: [d] },
      makeWireQuery(existing),
      makeComponentQuery(components),
      SCALE
    );
    // The port still blocks the A+B merge.
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

  // --- Split cases ---

  it('new wire endpoint lands on existing wire interior → splits existing', () => {
    // H (0.5,0.5)→(6.5,0.5); the new V ends at (3.5, 0.5).
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    existing.push(h);
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(3.5, -2.5);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [v] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h);
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
    const v = new Wire(WireDirection.VERTICAL, 3);
    v.position.set(3.5, -2.5);
    existing.push(v);
    // H (0.5,0.5)→(6.5,0.5); its interior contains the V endpoint.
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [h] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).not.toContain(v);
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
    // AND at (4,0) facing East: input ports at (3.5, 0.5) and (3.5, 1.5). The
    // first lands inside the H wire (0.5,0.5)→(6.5,0.5).
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
    // Only (3.5, 0.5) is on h, so it splits once.
    expect(horizontals.length).toBe(2);
    h.destroy();
  });

  it('new wire interior crosses multiple existing endpoints → multiple splits', () => {
    // Verticals end at (3.5, 0.5) and (5.5, 0.5); new H (0.5,0.5)→(7.5,0.5).
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

  // --- Re-merge cases ---

  it('wire removed leaves merge-able collinear neighbors → merge', () => {
    // A (0.5,2.5)→(3.5,2.5) and B (3.5,2.5)→(6.5,2.5); V blocks at (3.5, 2.5).
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

  // --- Move cases ---

  it('moved wire endpoint lands on existing wire interior → splits existing', () => {
    const h = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    // The moved vertical now ends at (3.5, 0.5), on the H wire's interior.
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
    // A (0.5,0.5)→(3.5,0.5) and B (3.5,0.5)→(6.5,0.5); V has left the seam.
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const b = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
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
    expect(toRemove).toContain(a);
    expect(toRemove).toContain(b);
    const merged = toAdd.find(
      (w) => w.direction === WireDirection.HORIZONTAL && w.length === 6
    );
    expect(merged).toBeTruthy();
  });

  it('moved collinear pair whose seam lands on a wire interior → pair merges, no split', () => {
    // Split pieces H1 (0.5,2.5)→(3.5,2.5) and H2 (3.5,2.5)→(6.5,2.5) move
    // together so their seam sits on the interior of V (3.5,0.5)→(3.5,4.5).
    // Nothing else terminates at the seam, so the pair merges back and V stays
    // whole — a plain crossing.
    const v = makeWire(3, 0, WireDirection.VERTICAL, 4);
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 3);
    const h2 = makeWire(3, 2, WireDirection.HORIZONTAL, 3);
    existing.push(v, h1, h2);
    const { toAdd, toRemove } = integrator.integrate(
      {
        movedWires: [
          {
            wire: h1,
            oldSnapshot: {
              start: new Point(0.5, 0.5),
              end: new Point(3.5, 0.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(0, 0, 4, 1)
            }
          },
          {
            wire: h2,
            oldSnapshot: {
              start: new Point(3.5, 0.5),
              end: new Point(6.5, 0.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(3, 0, 4, 1)
            }
          }
        ]
      },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h1);
    expect(toRemove).toContain(h2);
    expect(toRemove).not.toContain(v);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].direction).toBe(WireDirection.HORIZONTAL);
    expect(toAdd[0].length).toBe(6);
  });

  it('moved T-junction (pair + port) lands on a wire interior → splits it', () => {
    // The same seam, but a component port terminates there — a genuine
    // T-junction moved as a selection. The port blocks the merge, so the
    // crossed wire splits and the junction taps it. AND at (4,0) facing East
    // puts an input port at (3.5, 0.5).
    const comp = makeAnd(2, Direction.E, 4, 0);
    components.push(comp);
    // V (3.5,-0.5)→(3.5,1.5): its interior contains the seam.
    const v = new Wire(WireDirection.VERTICAL, 2);
    v.position.set(3.5, -0.5);
    const h1 = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const h2 = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    existing.push(v, h1, h2);
    const { toAdd, toRemove } = integrator.integrate(
      {
        movedWires: [
          {
            wire: h1,
            oldSnapshot: {
              start: new Point(0.5, 10.5),
              end: new Point(3.5, 10.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(0, 10, 4, 1)
            }
          },
          {
            wire: h2,
            oldSnapshot: {
              start: new Point(3.5, 10.5),
              end: new Point(6.5, 10.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(3, 10, 4, 1)
            }
          }
        ],
        movedComponentPorts: [
          {
            oldPorts: [new Point(3.5, 10.5)],
            newPorts: comp.connectionPoints
          }
        ]
      },
      makeWireQuery(existing),
      makeComponentQuery(components),
      SCALE
    );
    expect(toRemove).toContain(v);
    expect(toRemove).not.toContain(h1);
    expect(toRemove).not.toContain(h2);
    const verticals = toAdd.filter(
      (w) => w.direction === WireDirection.VERTICAL
    );
    expect(verticals.length).toBe(2);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.length).toBe(0);
  });

  // --- Junction preservation ---

  it('new wire absorbing a T-junction arm → junction stays split', () => {
    // T-junction at (3.5,2.5): H pair h1|h2 plus a V stem. A new V drawn along
    // the stem and past the junction absorbs it, burying the junction inside
    // the merged span. The H pair must stay split and the span must re-cut.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 3);
    const h2 = makeWire(3, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(3, 2, WireDirection.VERTICAL, 3);
    existing.push(h1, h2, v);
    const n = makeWire(3, 0, WireDirection.VERTICAL, 4); // (3.5,0.5)→(3.5,4.5)
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(v);
    expect(toRemove).not.toContain(h1);
    expect(toRemove).not.toContain(h2);
    expect(
      toAdd.filter((w) => w.direction === WireDirection.HORIZONTAL).length
    ).toBe(0);
    const verticals = toAdd.filter(
      (w) => w.direction === WireDirection.VERTICAL
    );
    expect(verticals.map((w) => w.position.y).sort()).toEqual([0.5, 2.5]);
    expect(verticals.map((w) => w.length).sort()).toEqual([2, 3]);
    for (const w of toAdd) if (!w.destroyed) w.destroy();
  });

  it('new wire absorbing both arms of a joined crossing → crossing stays joined', () => {
    // Joined crossing at (3.5,2.5), all four arms ending there. A new H drawn
    // across absorbs both H arms; the V pair must not fuse behind it.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 3);
    const h2 = makeWire(3, 2, WireDirection.HORIZONTAL, 3);
    const v1 = makeWire(3, 0, WireDirection.VERTICAL, 2);
    const v2 = makeWire(3, 2, WireDirection.VERTICAL, 3);
    existing.push(h1, h2, v1, v2);
    const n = makeWire(1, 2, WireDirection.HORIZONTAL, 5); // (1.5,2.5)→(6.5,2.5)
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h1);
    expect(toRemove).toContain(h2);
    expect(toRemove).not.toContain(v1);
    expect(toRemove).not.toContain(v2);
    expect(
      toAdd.filter((w) => w.direction === WireDirection.VERTICAL).length
    ).toBe(0);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.map((w) => w.position.x).sort()).toEqual([0.5, 3.5]);
    expect(horizontals.map((w) => w.length).sort()).toEqual([3, 3]);
    for (const w of toAdd) if (!w.destroyed) w.destroy();
  });

  it('new wire absorbing both arms of a T-junction → arm pair re-splits at the stem', () => {
    // A lone stem, not a pair: absorbing both H arms buries the junction, and
    // the split pass must cut the merged span back open off that endpoint.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 3);
    const h2 = makeWire(3, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(3, 2, WireDirection.VERTICAL, 3);
    existing.push(h1, h2, v);
    const n = makeWire(1, 2, WireDirection.HORIZONTAL, 5); // (1.5,2.5)→(6.5,2.5)
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [n] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h1);
    expect(toRemove).toContain(h2);
    expect(toRemove).not.toContain(v);
    const horizontals = toAdd.filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals.map((w) => w.position.x).sort()).toEqual([0.5, 3.5]);
    expect(horizontals.map((w) => w.length).sort()).toEqual([3, 3]);
    for (const w of toAdd) if (!w.destroyed) w.destroy();
  });

  it('overlapping collinear pair absorbed with no perpendicular terminator → still merges', () => {
    // h1 and h2 overlap, so consolidation absorbs them, but no perpendicular
    // wire terminates inside the merged span — V only crosses. Nothing is a
    // junction, so the pair merges and V stays whole.
    const v = makeWire(3, 0, WireDirection.VERTICAL, 4);
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 4); // 0.5 → 4.5
    const h2 = makeWire(3, 2, WireDirection.HORIZONTAL, 3); // 3.5 → 6.5
    existing.push(v, h1, h2);
    const { toAdd, toRemove } = integrator.integrate(
      {
        movedWires: [
          {
            wire: h1,
            oldSnapshot: {
              start: new Point(0.5, 10.5),
              end: new Point(4.5, 10.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(0, 10, 5, 1)
            }
          },
          {
            wire: h2,
            oldSnapshot: {
              start: new Point(3.5, 10.5),
              end: new Point(6.5, 10.5),
              direction: WireDirection.HORIZONTAL,
              gridBounds: new Rectangle(3, 10, 4, 1)
            }
          }
        ]
      },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(h1);
    expect(toRemove).toContain(h2);
    expect(toRemove).not.toContain(v);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].direction).toBe(WireDirection.HORIZONTAL);
    expect(toAdd[0].length).toBe(6);
    for (const w of toAdd) if (!w.destroyed) w.destroy();
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
    // Collinear A|B|C with verticals D at (2.5,2.5) and E at (4.5,2.5) blocking
    // both seams; removing D and E must cascade into one merge.
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

  // --- Vacated points ---

  it('vacatedPoints: merges the pair whose terminator is already gone', () => {
    // Two collinear halves touching at (3.5, 0.5), whose stem the caller
    // already removed from the tree (the eraser's flow).
    const left = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const right = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    existing.push(left, right);
    const { toAdd, toRemove } = integrator.integrate(
      { vacatedPoints: [new Point(3.5, 0.5)] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toRemove).toContain(left);
    expect(toRemove).toContain(right);
    expect(toAdd.length).toBe(1);
    expect(toAdd[0].length).toBe(6);
  });

  it('vacatedPoints: a point on an interior with no terminator splits nothing', () => {
    const e = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    existing.push(e);
    const { toAdd, toRemove } = integrator.integrate(
      { vacatedPoints: [new Point(3.5, 0.5)] },
      makeWireQuery(existing),
      noComponentsQuery,
      SCALE
    );
    expect(toAdd.length).toBe(0);
    expect(toRemove.length).toBe(0);
  });
});
