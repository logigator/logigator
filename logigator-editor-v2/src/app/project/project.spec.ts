import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Container, Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { Direction } from '../utils/direction';
import { makeAnd, makeWire } from '../../testing/factories';

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

    // Query a rect that clearly overlaps the component body
    const query = new Rectangle(3, 3, 1, 1);
    expect(project.hasComponentCollision(query, query)).toBe(true);
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
    expect(
      project.hasComponentCollision(compB.gridBounds, compB.bodyGridBounds)
    ).toBe(false);

    compB.destroy({ children: true });
  });

  it("detects collision when component B's body enters component A's stub", () => {
    // Component A at (0,0): body [0,2)×[0,2), output stub [2,2.5)×[0,2)
    const compA = makeAnd(2);
    compA.position.set(0, 0);
    project.addComponent(compA);

    // Component B at (2,0): body starts at x=2 — inside A's output stub
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
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(false);
    wire.destroy();
  });

  it('wire entering body is a collision', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Wire from x=0.5 length 3 → ends at (3.5, 0.5), inside body
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(true);
    wire.destroy();
  });

  it('wire passing through the full body is a collision', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Wire from x=0.5 length 6 → passes through entire body
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 6);
    expect(project.hasWireBodyCollision(wire.gridBounds)).toBe(true);
    wire.destroy();
  });

  it('vertical wire in stub column does not touch body', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    // Vertical wire at x=2.5 (input stub column), y span [0.5, 4.5]
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

  // Body under test: Rectangle(3, 0, 2, 2) — covers x∈[3,5), y∈[0,2)

  it('returns false for an empty project', () => {
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(false);
  });

  it('horizontal wire passing through body is a collision', () => {
    // Wire gx=0, len=4: gridBounds=[0,5)×[0,1) — enters body at x=3
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(true);
    wire.destroy();
  });

  it('vertical wire passing through body is a collision', () => {
    // Vertical wire at (3,0) len=2: gridBounds=[3,4)×[0,3) — overlaps body
    const wire = makeWire(3, 0, WireDirection.VERTICAL, 2);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(true);
    wire.destroy();
  });

  it('wire whose right edge is exactly at the body left boundary is not a collision', () => {
    // Wire gx=0, len=2: gridBounds=[0,3)×[0,1) — right=3 equals body left=3 → no overlap
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 2);
    project.addWire(wire);
    expect(
      project.hasComponentBodyWireCollision(new Rectangle(3, 0, 2, 2))
    ).toBe(false);
    wire.destroy();
  });

  it('wire whose left edge is exactly at the body right boundary is not a collision', () => {
    // Wire gx=5, len=2: gridBounds=[5,8)×[0,1) — left=5 equals body right=5 → no overlap
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

  // Under the new split-on-touch invariants, a wire endpoint never sits on
  // another wire's interior at rest. A 3-wire T-junction at (2.5, 2.5) is the
  // canonical 3-termination junction: H1 + H2 collinear, V perpendicular.
  // H1 wire: makeWire(0,2,H,2) → (0.5,2.5)→(2.5,2.5)
  // H2 wire: makeWire(2,2,H,3) → (2.5,2.5)→(5.5,2.5)
  // V  wire: makeWire(2,0,V,2) → (2.5,0.5)→(2.5,2.5)

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
    // H and V cross at (2.5,2.5) but neither has an endpoint there.
    // Interior-on-interior is allowed and produces no CP under the new rule.
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

  it('captureDragCps does not capture CPs that sit at the interior of the dragged wire', () => {
    // CP at (2.5, 0.5) formed by 2 collinear H halves + 1 V wire. Dragging a
    // long H wire whose interior passes through that CP must NOT capture it,
    // since the long H doesn't have an endpoint there.
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

    // longH has no endpoint at (2.5, 0.5), so no CP is captured.
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
    // 3-wire T at (2.5, 2.5); move V away → CP disappears.
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
    // Place a Right-facing AND at (3,0): input tips at (2.5, 0.5)/(2.5, 1.5), output at (5.5, 0.5).
    // Two horizontal wires both ending at the same input tip would yield D=3 (E from stub,
    // W from each wire's W direction — dedup'd to just W), so use a 3-wire junction
    // at the (2.5, 0.5) input tip: one H wire ending there + one V wire ending there.
    // D = E (stub) + W (H wire end) + N (V wire end) = 3, T = 3 → CP.
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

    // Rotate the component. The Down rotation moves port tips elsewhere; the CP
    // at the old tip should disappear since the stub no longer terminates there.
    comp.direction = Direction.S;

    expect(cpAt(project, oldTip)).toBe(false);
  });

  it('recomputeCpsForMovedSelection drops stale CP at old position', () => {
    // 3-wire T at (2.5, 2.5); move V far away → CP at old position disappears.
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

describe('Project.toggleConnectionAt', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function wireCount(): number {
    return [...project.queryWiresInRange(new Rectangle(-100, -100, 200, 200))]
      .length;
  }

  describe('SPLIT — no CP at click point', () => {
    it('splits both crossing wires and creates a CP', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 5);
      project.addWire(h);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(false);

      project.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(4);
    });

    it('is a no-op when only one wire passes through the point (no crossing)', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      project.addWire(h);

      const p = new Point(2.5, 2.5);
      project.toggleConnectionAt(p);

      expect(wireCount()).toBe(1);
      expect(cpAt(project, p)).toBe(false);
    });

    it('supports undo', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 5);
      project.addWire(h);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      project.toggleConnectionAt(p);
      expect(cpAt(project, p)).toBe(true);

      project.actionManager.undo();
      expect(cpAt(project, p)).toBe(false);
      expect(wireCount()).toBe(2);
    });
  });

  describe('JOIN — CP at click point', () => {
    function buildXJunction(): void {
      project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 2));
      project.addWire(makeWire(2, 2, WireDirection.HORIZONTAL, 3));
      project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 2));
      project.addWire(makeWire(2, 2, WireDirection.VERTICAL, 3));
    }

    it('joins both wire pairs and removes the CP', () => {
      buildXJunction();
      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(true);

      project.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(false);
      expect(wireCount()).toBe(2);
    });

    it('is a no-op on a T-junction (3-endpoint, non-toggleable)', () => {
      const hLeft = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
      const hRight = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
      project.addWire(hLeft);
      project.addWire(hRight);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(true);
      const vId = v.id;

      project.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(3);
      expect(
        [
          ...project.queryWiresInRange(new Rectangle(-100, -100, 200, 200))
        ].some((w) => w.id === vId)
      ).toBe(true);
    });

    it('supports undo', () => {
      buildXJunction();
      const p = new Point(2.5, 2.5);
      project.toggleConnectionAt(p);
      expect(cpAt(project, p)).toBe(false);

      project.actionManager.undo();
      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(4);
    });
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
    // The quad tree (root [0,64]²) re-filters every *visited* element against
    // its live gridBounds, so a stale bucket is only observable once the tree
    // has branched: a query that never descends into the component's old
    // quadrant can't re-filter it. Force a split by exceeding the 4-element
    // leaf cap, with one filler per quadrant.
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

    // A rect deep in the SW quadrant: outside target's original NW bounds, and
    // the traversal won't descend the NW branch for it — target not found yet.
    const farRect = new Rectangle(2, 40, 1, 1);
    expect([...project.queryComponentsInRange(farRect)]).not.toContain(target);

    // Growing numInputs grows bodyGridHeight (→ gridBounds y[2,52], spanning the
    // NW and SW quadrants) and fires portsChange$, whose handler must re-bucket
    // target so spatial queries reflect the new bounds.
    target.numInputs = 50;

    expect([...project.queryComponentsInRange(farRect)]).toContain(target);
  });
});
