import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { Direction, WireDirection } from '@logigator/core';
import { MoveComponentsAction } from '../actions/actions/move-components.action';
import { makeAnd, makeWire } from '../../testing/factories';
import { environment } from '../../environments/environment';

describe('Project.hasComponentCollision', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('returns false for an empty project', () => {
    const bounds = new Rectangle(0, 0, 10, 10);
    expect(project.hasComponentCollision(bounds, bounds)).toBe(false);
  });

  it('detects direct overlap with a placed component', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);

    const query = new Rectangle(3, 3, 1, 1);
    expect(project.hasComponentCollision(query, query)).toBe(true);
  });

  it('allows adjacent components whose stubs touch (no collision)', () => {
    // A: body width 2 at (0,0), output stub reaching x=2.5.
    const compA = makeAnd(2);
    compA.position.set(0, 0);
    project.addComponent(compA);

    // B at (3,0): input stub at x=2.5, so its gridBounds start there too.
    const compB = makeAnd(2);
    compB.position.set(3, 0);
    expect(
      project.hasComponentCollision(compB.gridBounds, compB.bodyGridBounds)
    ).toBe(false);

    compB.destroy({ children: true });
  });

  it("detects collision when component B's body enters component A's stub", () => {
    // A at (0,0): body [0,2)×[0,2), output stub [2,2.5)×[0,2).
    const compA = makeAnd(2);
    compA.position.set(0, 0);
    project.addComponent(compA);

    // B at (2,0): its body starts inside A's output stub.
    const compB = makeAnd(2);
    compB.position.set(2, 0);
    expect(
      project.hasComponentCollision(compB.gridBounds, compB.bodyGridBounds)
    ).toBe(true);

    compB.destroy({ children: true });
  });

  it('excludes a component when its id is in excludeIds', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);

    const bounds = new Rectangle(3, 3, 1, 1);
    expect(
      project.hasComponentCollision(bounds, bounds, new Set([comp.id]))
    ).toBe(false);
  });
});

describe('Project.hasWireBodyCollision', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  // Right-facing AND at (3,0): body [3,5)×[0,2), input stub at x=2.5, output
  // stub at x=5.5.

  it('wire endpoint exactly at stub tip is not a collision', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Ends exactly on the input stub tip (2.5, 0.5).
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(false);
    wire.destroy();
  });

  it('wire entering body is a collision', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Ends at (3.5, 0.5), inside the body.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(true);
    wire.destroy();
  });

  it('wire passing through the full body is a collision', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Passes through the whole body.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(true);
    wire.destroy();
  });

  it('vertical wire in stub column does not touch body', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // In the input stub column, spanning y [0.5, 4.5].
    const wire = makeWire(2, 0, WireDirection.VERTICAL, 4);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(false);
    wire.destroy();
  });

  it('excludeIds exempts a component', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    expect(
      project.hasWireBodyCollision(wire.gridBounds, new Set([comp.id]))
    ).toBe(false);
    wire.destroy();
  });
});

describe('Project.hasComponentBodyWireCollision', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('returns false for an empty project', () => {
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(false);
  });

  it('horizontal wire passing through body is a collision', () => {
    // gridBounds [0,5)×[0,1) enters the body at x=3.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(true);
    wire.destroy();
  });

  it('vertical wire passing through body is a collision', () => {
    // gridBounds [3,4)×[0,3) overlaps the body.
    const wire = makeWire(3, 0, WireDirection.VERTICAL, 2);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(true);
    wire.destroy();
  });

  it('wire whose right edge is exactly at the body left boundary is not a collision', () => {
    // gridBounds right=3 equals the body's left edge, so they don't overlap.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(false);
    wire.destroy();
  });

  it('wire whose left edge is exactly at the body right boundary is not a collision', () => {
    // gridBounds left=5 equals the body's right edge, so they don't overlap.
    const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 2);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(false);
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
    ).toBe(false);
    wire.destroy();
  });
});

function cpAt(project: Project, p: Point): boolean {
  return project.connectionPoints.hasCpAt(p);
}

describe('Project connection-point integration', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  // A wire endpoint never rests on another wire's interior, so the canonical
  // 3-termination junction is a T at (2.5, 2.5): collinear H1 (0.5,2.5)→
  // (2.5,2.5) and H2 (2.5,2.5)→(5.5,2.5), plus V (2.5,0.5)→(2.5,2.5).

  it('addWire creates CP at 3-wire T-junction', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    const jn = new Point(2.5, 2.5);

    project.addWire(h1);
    project.addWire(h2);
    expect(cpAt(project, jn)).toBe(false);

    project.addWire(v);
    expect(cpAt(project, jn)).toBe(true);
  });

  it('removeWire removes CP that depended on the removed wire', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(true);

    project.removeWire(v.id);
    expect(cpAt(project, jn)).toBe(false);
  });

  it('pure 2-wire X crossing (no endpoint at crossing) — no CP', () => {
    // Interior-on-interior crossing: allowed, and produces no CP.
    const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 5);
    project.addWire(h);
    project.addWire(v);
    expect(cpAt(project, new Point(2.5, 2.5))).toBe(false);
  });

  it('3-wire T (2 collinear H endpoints + 1 V endpoint) — CP', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);
    expect(cpAt(project, new Point(2.5, 2.5))).toBe(true);
  });

  it('applyTheme restyles existing CPs in place (same instance, selection kept)', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    const cp = project.connectionPoints.getCpAt(jn);
    expect(cp).toBeDefined();
    cp!.selected = true;
    const selectionTint = cp!.tint;

    project.applyTheme(false);

    // A theme change recolours in place, keeping the instance and its
    // selection state.
    expect(project.connectionPoints.getCpAt(jn)).toBe(cp);
    expect(cp!.destroyed).toBe(false);
    expect(cp!.selected).toBe(true);
    expect(cp!.tint).toBe(selectionTint);
  });

  // A drag maintains termination counts out of band: detach drops them at the
  // old positions, reattach re-adds them at the new ones, and the settle pass
  // reconciles the visible dots.
  it('dragging an endpoint onto a 2-termination point creates a CP', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2); // end (2.5,2.5)
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2); // end (2.5,2.5)
    project.addWire(h1);
    project.addWire(v);
    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(false); // T=2, no dot

    const mover = makeWire(5, 5, WireDirection.HORIZONTAL, 2);
    project.addWire(mover);
    const oldSnap = Wire.snapshot(mover);

    // Drag its start onto the junction: detach → move → reattach → settle.
    project.detachForDrag([], [mover]);
    mover.position.set(mover.position.x - 3, mover.position.y - 3);
    project.reattachFromDrag([], [mover]);
    project.connectionPoints.recomputeCpsForMovedSelection(
      new Map(),
      [oldSnap],
      [],
      [mover]
    );

    expect(cpAt(project, jn)).toBe(true); // T=3 now
  });

  it('dragging an endpoint away from a 3-junction destroys its CP', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);
    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(true); // T=3

    const oldSnap = Wire.snapshot(v);
    project.detachForDrag([], [v]);
    v.position.set(v.position.x + 4, v.position.y);
    project.reattachFromDrag([], [v]);
    project.connectionPoints.recomputeCpsForMovedSelection(
      new Map(),
      [oldSnap],
      [],
      [v]
    );

    expect(cpAt(project, jn)).toBe(false); // T=2 now
  });

  it('detachForDrag does not remove existing CPs, reattachFromDrag does not recompute', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(true);

    project.detachForDrag([], [v]);
    expect(cpAt(project, jn)).toBe(true);

    project.reattachFromDrag([], [v]);
    expect(cpAt(project, jn)).toBe(true);
  });

  it('captureDragCps moves the CP at wire endpoint into the drag layer', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(true);

    project.detachForDrag([], [v]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [v],
      dragLayer
    );

    expect(cpAt(project, jn)).toBe(false);
    expect(captured.length).toBe(1);
    expect(dragLayer.children.length).toBe(1);

    dragLayer.destroy({ children: true });
  });

  it('captureDragCps skips a termination-point CP absent from the given set', () => {
    // The CP is not in the selected set, so it stays put even though the
    // dragged wire terminates there: what moves matches what looks selected.
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    expect(cpAt(project, jn)).toBe(true);

    project.detachForDrag([], [v]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [v],
      dragLayer,
      new Set()
    );

    expect(captured.length).toBe(0);
    expect(cpAt(project, jn)).toBe(true);
    expect(dragLayer.children.length).toBe(0);

    project.reattachFromDrag([], [v]);
    dragLayer.destroy();
  });

  it('captureDragCps does not capture CPs that sit at the interior of the dragged wire', () => {
    // A CP at (2.5, 0.5) from two collinear H halves plus a V. A dragged wire
    // whose interior merely passes through it has no endpoint there.
    const longH = makeWire(-5, 5, WireDirection.HORIZONTAL, 20);
    const h1 = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 0, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 3);
    project.addWire(longH);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 0.5);
    expect(cpAt(project, jn)).toBe(true);

    project.detachForDrag([], [longH]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [longH],
      dragLayer
    );

    expect(cpAt(project, jn)).toBe(true);
    expect(captured.length).toBe(0);

    project.reattachFromDrag([], [longH]);
    dragLayer.destroy();
  });

  it('discardDragCps destroys captured CPs', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    project.detachForDrag([], [v]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [v],
      dragLayer
    );
    expect(captured.length).toBe(1);

    const cp = captured[0];
    project.connectionPoints.discardDragCps(captured);
    expect(cp.destroyed).toBe(true);

    dragLayer.destroy();
  });

  it('restoreDragCps puts captured CPs back into the manager', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const jn = new Point(2.5, 2.5);
    project.detachForDrag([], [v]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [v],
      dragLayer
    );
    expect(cpAt(project, jn)).toBe(false);

    project.connectionPoints.restoreDragCps(captured);
    expect(cpAt(project, jn)).toBe(true);

    project.reattachFromDrag([], [v]);
    dragLayer.destroy();
  });

  it('moveWire updates CPs', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    expect(cpAt(project, new Point(2.5, 2.5))).toBe(true);

    project.moveWire(v.id, new Point(20.5, 20.5));

    expect(cpAt(project, new Point(2.5, 2.5))).toBe(false);
  });

  it('rotating a component via the direction setter updates CPs', () => {
    // Right-facing AND at (3,0), input tip (2.5, 0.5). Two H wires ending
    // there would share the W direction and dedup to D=2, so the junction is
    // one H plus one V: D = E (stub) + W + N = 3 and T = 3, hence a CP.
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    const hWire = new Wire(WireDirection.HORIZONTAL, 2);
    hWire.position.set(0.5, 0.5);
    project.addWire(hWire);
    const vWire = new Wire(WireDirection.VERTICAL, 3);
    vWire.position.set(2.5, -2.5);
    project.addWire(vWire);

    const oldTip = new Point(2.5, 0.5);
    expect(cpAt(project, oldTip)).toBe(true);

    // Rotating moves the port tips, so the stub stops terminating at the old
    // one and its CP disappears.
    comp.direction = Direction.S;

    expect(cpAt(project, oldTip)).toBe(false);
  });

  it('recomputeCpsForMovedSelection drops stale CP at old position', () => {
    const h1 = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
    const h2 = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
    const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
    project.addWire(h1);
    project.addWire(h2);
    project.addWire(v);

    const oldJn = new Point(2.5, 2.5);
    expect(cpAt(project, oldJn)).toBe(true);

    const oldSnap = Wire.snapshot(v);

    project.detachForDrag([], [v]);
    const dragLayer = new Container();
    const captured = project.connectionPoints.captureDragCps(
      [],
      [v],
      dragLayer
    );

    v.position.set(20.5, 20.5);
    project.reattachFromDrag([], [v]);

    project.connectionPoints.discardDragCps(captured);
    project.connectionPoints.recomputeCpsForMovedSelection(
      new Map(),
      [oldSnap],
      [],
      [v]
    );

    expect(cpAt(project, oldJn)).toBe(false);

    dragLayer.destroy();
  });
});

describe('Project.getContentBounds', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('returns null for an empty project', () => {
    expect(project.getContentBounds()).toBeNull();
  });

  it('returns a single component’s gridBounds', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    const b = project.getContentBounds()!;
    const g = comp.gridBounds;
    expect(b.x).toBeCloseTo(g.x);
    expect(b.y).toBeCloseTo(g.y);
    expect(b.right).toBeCloseTo(g.right);
    expect(b.bottom).toBeCloseTo(g.bottom);
  });

  it('unions components and wires across the board', () => {
    // gridBounds x∈[2.5,5.5], y∈[0,2].
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);
    // gridBounds x∈[2,3], y∈[5,10].
    const wire = makeWire(2, 5, WireDirection.VERTICAL, 4);
    project.addWire(wire);

    const b = project.getContentBounds()!;
    expect(b.x).toBeCloseTo(2); // wire left edge
    expect(b.y).toBeCloseTo(0); // component top
    expect(b.right).toBeCloseTo(5.5); // component output stub tip
    expect(b.bottom).toBeCloseTo(10); // wire bottom
  });
});

describe('Project portsChange$ rebucket', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('re-queries a component at its grown bounds after a numInputs increase', () => {
    // The quad tree re-filters every *visited* element against its live
    // gridBounds, so a stale bucket only shows once the tree has branched and
    // a query can skip the old quadrant. Exceed the 4-element leaf cap to
    // force the split.
    const target = makeAnd(2); // NW: gridBounds ≈ x[1.5,4.5] y[2,4]
    target.position.set(2, 2);
    project.addComponent(target);
    for (const [x, y] of [
      [40, 2], // NE
      [2, 40], // SW
      [40, 40], // SE
      [45, 5] // NE (5th element → root leaf splits into quadrants)
    ] as const) {
      const filler = makeAnd(2);
      filler.position.set(x, y);
      project.addComponent(filler);
    }

    // Deep in the SW quadrant, so the traversal never descends into NW.
    const farRect = new Rectangle(2, 40, 1, 1);
    expect(project.queryComponentsInRange(farRect)).not.toContain(target);

    // Growing numInputs grows gridBounds to y[2,52], spanning NW and SW, and
    // fires portsChange$, whose handler must re-bucket target.
    target.options.numInputs.value = 50;

    expect(project.queryComponentsInRange(farRect)).toContain(target);
  });
});

describe('Project.cull', () => {
  let project: Project;

  const gridSize = environment.gridSize;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    project.viewport.resizeViewport(gridSize * 10, gridSize * 10);
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  /** True if the element renders as culled, i.e. any ancestor is culled. */
  function isCulled(element: Container): boolean {
    for (let c: Container | null = element; c; c = c.parent) {
      if (c.culled) return true;
    }
    return false;
  }

  it('keeps on-screen components and wires visible', () => {
    const comp = makeAnd(2);
    comp.position.set(2, 2);
    project.addComponent(comp);
    const wire = makeWire(5, 5, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);

    project.cull();

    expect(isCulled(comp)).toBe(false);
    expect(isCulled(wire)).toBe(false);
  });

  it('culls both trees when the viewport is panned off the circuit', () => {
    const comp = makeAnd(2);
    comp.position.set(2, 2);
    project.addComponent(comp);
    const wire = makeWire(5, 5, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);

    project.viewport.setPosition(new Point(-gridSize * 1000, -gridSize * 1000));
    project.cull();

    expect(isCulled(comp)).toBe(true);
    expect(isCulled(wire)).toBe(true);
  });

  it('panning back re-reveals culled elements', () => {
    const comp = makeAnd(2);
    comp.position.set(2, 2);
    project.addComponent(comp);

    project.viewport.setPosition(new Point(-gridSize * 1000, -gridSize * 1000));
    project.cull();
    project.viewport.setPosition(new Point(0, 0));
    project.cull();

    expect(isCulled(comp)).toBe(false);
  });
});

describe('Project selection grab rect', () => {
  let project: Project;
  let show: ReturnType<typeof vi.spyOn>;
  let hide: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    show = vi.spyOn(project.floatingLayer, 'showSelectionRect');
    hide = vi.spyOn(project.floatingLayer, 'hideSelectionRect');
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('shows the padded grab rect when a selection commits', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);

    project.selectionManager.select([comp], []);

    expect(show).toHaveBeenCalledWith(project.selectionManager.grabRect());
    const rect = show.mock.calls.at(-1)![0] as Rectangle;
    const m = SelectionManager.GRAB_MARGIN;
    expect(rect.x).toBe(comp.gridBounds.x - m);
    expect(rect.right).toBe(comp.gridBounds.right + m);
  });

  it('hides the grab rect when the selection clears', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    project.selectionManager.clear();

    expect(hide).toHaveBeenCalled();
  });

  it('re-fits the grab rect when a committed move and its undo change the bounds', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);
    const before = show.mock.calls.at(-1)![0] as Rectangle;

    project.actionManager.push(
      new MoveComponentsAction({
        id: comp.id,
        oldPos: new Point(3, 3),
        newPos: new Point(10, 3)
      })
    );
    const moved = show.mock.calls.at(-1)![0] as Rectangle;
    expect(moved.x).toBe(before.x + 7);

    project.actionManager.undo();
    const undone = show.mock.calls.at(-1)![0] as Rectangle;
    expect(undone.x).toBe(before.x);
  });
});
