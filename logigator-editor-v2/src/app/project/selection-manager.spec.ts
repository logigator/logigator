import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { SelectionManager } from './selection-manager';
import { WorkMode } from '../work-mode/work-mode.enum';
import { setStaticDIInjector } from '../utils/get-di';
import { AndComponent } from '../components/component-types/and/and.component';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { WireDirection } from '../wires/wire-direction.enum';
import { ActionContainer } from '../actions/action-container';
import type { Project } from './project';

// ---------------------------------------------------------------------------
// Fake factories
// ---------------------------------------------------------------------------

/**
 * Creates a minimal component-like object. Because the only place that uses
 * `instanceof Component` is `evict()`, every other test path works fine with
 * a plain object. The `evict()` tests use a real AndComponent instead.
 */
function makeComponent(x: number, y: number, w: number, h: number): any {
  return {
    tint: 0xffffff,
    destroyed: false,
    connectionPoints: [] as Point[],
    get gridBounds() {
      return new Rectangle(x, y, w, h);
    }
  };
}

/** Creates a minimal wire-like object. */
function makeWire(x: number, y: number, w: number, h: number): any {
  return {
    tint: 0xffffff,
    destroyed: false,
    connectionPoints: [new Point(x, y), new Point(x + w - 1, y)] as [
      Point,
      Point
    ],
    get gridBounds() {
      return new Rectangle(x, y, w, h);
    }
  };
}

/**
 * Wire-like fake that also exposes position/direction/length so cutWire() can
 * inspect it. gridBounds mirrors Wire.gridBounds: floor(position) extended by 1
 * on the spanning axis.
 */
function makeFullWire(
  direction: WireDirection,
  posX: number,
  posY: number,
  length: number
): any {
  const gridX = Math.floor(posX);
  const gridY = Math.floor(posY);
  const gridBounds =
    direction === WireDirection.HORIZONTAL
      ? new Rectangle(gridX, gridY, length + 1, 1)
      : new Rectangle(gridX, gridY, 1, length + 1);
  const pos = new Point(posX, posY);
  const endPoint =
    direction === WireDirection.HORIZONTAL
      ? new Point(posX + length, posY)
      : new Point(posX, posY + length);
  return {
    tint: 0xffffff,
    destroyed: false,
    direction,
    position: pos,
    length,
    gridBounds,
    connectionPoints: [pos, endPoint] as [Point, Point]
  };
}

/** Create a real AndComponent (requires DI). */
function makeAnd(numInputs = 2): AndComponent {
  return new AndComponent({
    direction: andComponentConfig.options.direction.clone(),
    numInputs: andComponentConfig.options.numInputs.clone(numInputs)
  });
}

/**
 * Configure the project spy so queryComponentsInRange yields the given items.
 * Uses callFake so a fresh generator is created on each call (generators are
 * single-use iterators; returnValue would exhaust after the first iteration).
 */
function setComponents(project: MockedObject<Project>, ...items: any[]): void {
  project.queryComponentsInRange.mockImplementation(function* () {
    yield* items;
  });
}

/** Configure the project spy so queryWiresInRange yields the given items. */
function setWires(project: MockedObject<Project>, ...items: any[]): void {
  project.queryWiresInRange.mockImplementation(function* () {
    yield* items;
  });
}

function makeProject(): MockedObject<Project> {
  const project = {
    queryComponentsInRange: vi.fn().mockName('Project.queryComponentsInRange'),
    queryWiresInRange: vi.fn().mockName('Project.queryWiresInRange'),
    addWire: vi.fn().mockName('Project.addWire'),
    removeWire: vi.fn().mockName('Project.removeWire')
  };
  // SelectionManager.SELECT_EXACT path may push to actionManager; install a spy.
  (project as any).actionManager = {
    push: vi.fn().mockName('ActionManager.push')
  };
  // retintCps() reads project.connectionPoints.getCpsAtPoints — provide a no-op stub.
  (project as any).connectionPoints = {
    getCpsAtPoints: vi.fn().mockReturnValue([])
  };

  return project as unknown as MockedObject<Project>;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SelectionManager', () => {
  let project: MockedObject<Project>;
  let manager: SelectionManager;

  beforeEach(() => {
    project = makeProject();
    setComponents(project);
    setWires(project);
    manager = new SelectionManager(project);
  });

  // ── isEmpty / initial state ────────────────────────────────────────────────

  describe('isEmpty / initial state', () => {
    it('is empty on construction', () => {
      expect(manager.isEmpty).toBe(true);
    });

    it('selectedComponents is empty on construction', () => {
      expect(manager.selectedComponents.size).toBe(0);
    });

    it('selectedWires is empty on construction', () => {
      expect(manager.selectedWires.size).toBe(0);
    });

    it('selectionChange$ is an Observable', () => {
      // Must be subscribable and not throw synchronously.
      let subscribed = false;
      manager.selectionChange$
        .subscribe(() => (subscribed = true))
        .unsubscribe();
      // No emission expected on mere subscription.
      expect(subscribed).toBe(false);
    });
  });

  // ── commit — rect mode (SELECT) ────────────────────────────────────────────

  describe('commit — rect mode (SELECT)', () => {
    it('adds components returned by queryComponentsInRange to selectedComponents', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
    });

    it('sets SELECTION_TINT on selected components', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(comp.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('adds wires returned by queryWiresInRange to selectedWires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.selectedWires.has(wire)).toBe(true);
    });

    it('sets SELECTION_TINT on selected wires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(wire.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('clears the previous selection on a second commit', () => {
      const compA = makeComponent(0, 0, 2, 2);
      setComponents(project, compA);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      // Second commit with a different component and no wires.
      const compB = makeComponent(10, 10, 2, 2);
      setComponents(project, compB);
      setWires(project);
      manager.commit(new Rectangle(10, 10, 5, 5), WorkMode.SELECT);

      expect(manager.selectedComponents.has(compA)).toBe(false);
      expect(manager.selectedComponents.has(compB)).toBe(true);
      // tint of previously selected component is restored.
      expect(compA.tint).toBe(0xffffff);
    });

    it('isEmpty becomes false after committing with results', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.isEmpty).toBe(false);
    });
  });

  // ── commit — SELECT_EXACT mode (scissor select) ───────────────────────────
  //
  // SELECT_EXACT selects everything touching the rect (same intersect rule as
  // SELECT) but additionally scissors wires that extend past the rect at the
  // rect boundary. The inside piece(s) are then selected via re-query.

  describe('commit — SELECT_EXACT mode', () => {
    it('includes a component fully inside the rect', () => {
      const comp = makeComponent(2, 2, 3, 3);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT_EXACT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
    });

    it('includes a component that partially overlaps the rect boundary (touching rule)', () => {
      // Old behavior excluded this; new behavior matches SELECT — touch is enough.
      const comp = makeComponent(5, 2, 3, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(2, 2, 4, 4), WorkMode.SELECT_EXACT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
    });

    it('does not push any action when the rect contains no wires', () => {
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT_EXACT);

      expect((project as any).actionManager.push).not.toHaveBeenCalled();
    });

    it('selects a wire fully inside the rect without pushing a cut action', () => {
      // Wire (1.5, 1.5) length 2 → gridBounds (1, 1, 3, 1) fully inside (0,0,5,5).
      const wire = makeFullWire(WireDirection.HORIZONTAL, 1.5, 1.5, 2);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT_EXACT);

      expect(manager.selectedWires.has(wire)).toBe(true);
      expect((project as any).actionManager.push).not.toHaveBeenCalled();
    });

    it('does not cut OR select a wire whose centerline sits outside the rect (half-cell padding only overlap)', () => {
      // Wire at y=4.5, rect.y=3.7 height=0.4 → rect.bottom=4.1.
      // gridBounds intersect via half-cell padding but centerline is outside.
      // SELECT_EXACT must reject it on both counts: no cut action AND not selected.
      const wire = makeFullWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 3.7, 12, 0.4), WorkMode.SELECT_EXACT);

      expect((project as any).actionManager.push).not.toHaveBeenCalled();
      expect(manager.selectedWires.has(wire)).toBe(false);
    });

    describe('with real Wire (cut path)', () => {
      beforeEach(() => {
        setStaticDIInjector(TestBed.inject(Injector));
      });

      it('does NOT push to ActionManager when a wire crosses the rect boundary (deferred cut)', () => {
        // The cut is tentative until SelectionMoveSession claims it. This is
        // the regression guard for: a SELECT_EXACT drag that scissors a wire
        // must not pollute the undo history if no move follows.
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);

        expect((project as any).actionManager.push).not.toHaveBeenCalled();
        expect(manager.hasPendingCut).toBe(true);
      });

      it('mutates the project directly with addWire/removeWire when cutting', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);

        // Rect (5,4)+(2,1) cuts the wire into 3 pieces: outside-left, inside,
        // outside-right. Originals are removed via project.removeWire(id).
        expect(project.removeWire).toHaveBeenCalledTimes(1);
        expect(project.addWire).toHaveBeenCalledTimes(3);
      });

      it('does not push an action when the only wire is fully inside the rect', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 1.5, 1.5, 2);
        setWires(project, wire);

        manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT_EXACT);

        expect((project as any).actionManager.push).not.toHaveBeenCalled();
      });

      // Regression test: a free-form drag rect has non-integer bounds, which means
      // outside-piece gridBounds half-cell padding still intersects the rect via
      // PixiJS' strict-< rule. The SelectionManager must therefore identify
      // inside pieces by their own bookkeeping rather than any post-cut query.
      it('selects only the inside piece when the rect has non-integer bounds', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
        setWires(project, wire);

        const addedWires: any[] = [];
        project.addWire.mockImplementation((w: any) => {
          addedWires.push(w);
        });

        manager.commit(new Rectangle(4.7, 4, 2.6, 1), WorkMode.SELECT_EXACT);

        // Cut produces three live Wire instances added directly via project.addWire.
        expect(addedWires.length).toBe(3);

        const insidePiece = addedWires.find((w) => w.position.x === 3.5);
        const outsideLeft = addedWires.find((w) => w.position.x === 0.5);
        const outsideRight = addedWires.find((w) => w.position.x === 8.5);

        expect(insidePiece).toBeDefined();
        expect(outsideLeft).toBeDefined();
        expect(outsideRight).toBeDefined();

        expect(manager.selectedWires.has(insidePiece)).toBe(true);
        expect(manager.selectedWires.has(outsideLeft)).toBe(false);
        expect(manager.selectedWires.has(outsideRight)).toBe(false);

        // Inside piece is tinted; outside pieces stay at default tint.
        expect(insidePiece.tint).toBe(SelectionManager.SELECTION_TINT);
        expect(outsideLeft.tint).toBe(0xffffff);
        expect(outsideRight.tint).toBe(0xffffff);
      });

      it('clear() rolls back the pending cut: adds originals back, removes pieces', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasPendingCut).toBe(true);

        project.addWire.mockClear();
        project.removeWire.mockClear();

        manager.clear();

        expect(manager.hasPendingCut).toBe(false);
        // Rollback removes the 3 new pieces and re-adds the 1 original.
        expect(project.removeWire).toHaveBeenCalledTimes(3);
        expect(project.addWire).toHaveBeenCalledTimes(1);
      });

      it('claimPendingCut returns an ActionContainer and clears the pending state', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasPendingCut).toBe(true);

        project.addWire.mockClear();
        project.removeWire.mockClear();

        const claimed = manager.claimPendingCut();

        expect(claimed).toBeInstanceOf(ActionContainer);
        expect(manager.hasPendingCut).toBe(false);
        // Claim does NOT mutate the project — it just hands the rollback data
        // to the caller (the move session) to fold into its ActionContainer.
        expect(project.removeWire).not.toHaveBeenCalled();
        expect(project.addWire).not.toHaveBeenCalled();
      });

      it('claimPendingCut returns null when nothing is pending', () => {
        expect(manager.claimPendingCut()).toBeNull();
      });

      it('rollbackPendingCut returns true after a cut and false when nothing is pending', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        expect(manager.rollbackPendingCut()).toBe(false);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);

        expect(manager.rollbackPendingCut()).toBe(true);
        expect(manager.hasPendingCut).toBe(false);
        expect(manager.rollbackPendingCut()).toBe(false);
      });
    });
  });

  // ── commit — single click (zero-size rect) ─────────────────────────────────

  describe('commit — single click (zero-size rect)', () => {
    it('selects a component whose gridBounds contains the click point', () => {
      // Click at (3, 3). Component covers (2,2)+(2,2) → contains (3,3).
      const comp = makeComponent(2, 2, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(comp.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('selects a wire when no component is at the click point', () => {
      // Wire at (0,3) w=5 h=1 → contains (2,3).
      const wire = makeWire(0, 3, 5, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(2, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedWires.has(wire)).toBe(true);
      expect(wire.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('prefers the component over a wire when the component has a smaller bounding area', () => {
      // Click at (3,3). Component: 1×1 area=1. Wire: 5×2 area=10.
      const comp = makeComponent(3, 3, 1, 1); // area=1; contains (3,3)
      const wire = makeWire(0, 2, 5, 2); // area=10; contains (3,3)
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(manager.selectedWires.has(wire)).toBe(false);
    });

    it('selects the wire when the wire has a smaller area than the component', () => {
      // Click at (3,3). Component: 4×4 area=16. Wire: 1×1 area=1.
      const comp = makeComponent(1, 1, 4, 4); // area=16; contains (3,3)
      const wire = makeWire(3, 3, 1, 1); // area=1;  contains (3,3)
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(false);
      expect(manager.selectedWires.has(wire)).toBe(true);
    });

    it('selects nothing when the click point is in empty space', () => {
      // Component exists in the query result but its bounds do NOT contain the click.
      const comp = makeComponent(10, 10, 2, 2); // far away from click (3,3)
      setComponents(project, comp);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.isEmpty).toBe(true);
    });

    it('ignores destroyed components during single-click resolution', () => {
      const comp = makeComponent(2, 2, 2, 2);
      comp.destroyed = true;
      setComponents(project, comp);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.isEmpty).toBe(true);
    });

    it('selects the component when component and wire have equal bounding area', () => {
      // Click at (3,3). Both have area 1×1=1. Component wins (<=).
      const comp = makeComponent(3, 3, 1, 1);
      const wire = makeWire(3, 3, 1, 1);
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(manager.selectedWires.has(wire)).toBe(false);
    });
  });

  // ── clear ──────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties selectedComponents', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(manager.selectedComponents.size).toBe(0);
    });

    it('empties selectedWires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(manager.selectedWires.size).toBe(0);
    });

    it('restores tint to 0xffffff on non-destroyed components', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);
      expect(comp.tint).toBe(SelectionManager.SELECTION_TINT);

      manager.clear();

      expect(comp.tint).toBe(0xffffff);
    });

    it('restores tint to 0xffffff on non-destroyed wires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(wire.tint).toBe(0xffffff);
    });

    it('skips tint restoration for destroyed components', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      // Simulate destruction after the component was selected.
      comp.destroyed = true;

      manager.clear();

      // Tint must NOT have been reset — still SELECTION_TINT.
      expect(comp.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('skips tint restoration for destroyed wires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      wire.destroyed = true;

      manager.clear();

      expect(wire.tint).toBe(SelectionManager.SELECTION_TINT);
    });

    it('isEmpty is true after clear', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(manager.isEmpty).toBe(true);
    });
  });

  // ── evict ──────────────────────────────────────────────────────────────────
  //
  // evict() uses `instanceof Component` to distinguish between the two sets.
  // We use real AndComponent instances (via TestBed DI) to satisfy that check.

  describe('evict', () => {
    let comp: AndComponent;

    beforeEach(() => {
      setStaticDIInjector(TestBed.inject(Injector));
      comp = makeAnd(2);
    });

    afterEach(() => {
      comp.destroy({ children: true });
    });

    it('removes a selected component from selectedComponents', () => {
      // Manually insert the real component into the manager via commit.
      setComponents(project, comp);
      manager.commit(new Rectangle(-10, -10, 20, 20), WorkMode.SELECT);
      expect(manager.selectedComponents.has(comp)).toBe(true);

      manager.evict(comp);

      expect(manager.selectedComponents.has(comp)).toBe(false);
    });

    it('removes a selected wire from selectedWires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);
      expect(manager.selectedWires.has(wire)).toBe(true);

      manager.evict(wire);

      expect(manager.selectedWires.has(wire)).toBe(false);
    });

    it('does not emit selectionChange$ when evicting a component not in selection', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      // comp was never committed.
      manager.evict(comp);

      expect(emitCount).toBe(0);
    });

    it('emits selectionChange$ when evicting a selected component', () => {
      setComponents(project, comp);
      manager.commit(new Rectangle(-10, -10, 20, 20), WorkMode.SELECT);

      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.evict(comp);

      expect(emitCount).toBe(1);
    });

    it('does not emit selectionChange$ when evicting a wire not in selection', () => {
      const wire = makeWire(0, 0, 3, 1);
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.evict(wire);

      expect(emitCount).toBe(0);
    });
  });

  // ── containsPoint ──────────────────────────────────────────────────────────

  describe('containsPoint', () => {
    it('returns true when a selected component bounds contain the point', () => {
      const comp = makeComponent(1, 1, 4, 4); // covers (1,1)–(5,5)
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT);

      expect(manager.containsPoint({ x: 3, y: 3 })).toBe(true);
    });

    it('returns false when the point is outside all selected bounds', () => {
      const comp = makeComponent(1, 1, 2, 2); // covers (1,1)–(3,3)
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT);

      expect(manager.containsPoint({ x: 10, y: 10 })).toBe(false);
    });

    it('returns true when a selected wire bounds contain the point', () => {
      const wire = makeWire(0, 5, 10, 1); // covers y=5 to y=6
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 15, 15), WorkMode.SELECT);

      expect(manager.containsPoint({ x: 5, y: 5 })).toBe(true);
    });

    it('returns false when the selection is empty', () => {
      expect(manager.containsPoint({ x: 0, y: 0 })).toBe(false);
    });

    it('returns false for a destroyed component even if its bounds would contain the point', () => {
      const comp = makeComponent(0, 0, 5, 5);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT);

      comp.destroyed = true;

      expect(manager.containsPoint({ x: 2, y: 2 })).toBe(false);
    });

    it('returns false for a destroyed wire even if its bounds would contain the point', () => {
      const wire = makeWire(0, 0, 5, 5);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT);

      wire.destroyed = true;

      expect(manager.containsPoint({ x: 2, y: 2 })).toBe(false);
    });
  });

  // ── boundingBox ────────────────────────────────────────────────────────────

  describe('boundingBox', () => {
    it('returns null when selection is empty', () => {
      expect(manager.boundingBox()).toBeNull();
    });

    it('returns the exact rect for a single selected component', () => {
      const comp = makeComponent(2, 3, 4, 5);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 20, 20), WorkMode.SELECT);

      const bb = manager.boundingBox();

      expect(bb).not.toBeNull();
      expect(bb!.x).toBe(2);
      expect(bb!.y).toBe(3);
      expect(bb!.width).toBe(4);
      expect(bb!.height).toBe(5);
    });

    it('returns tight bounding box enclosing multiple elements', () => {
      // comp: (0,0,3,2) → right=3, bottom=2
      // wire: (1,1,5,1) → right=6, bottom=2
      const comp = makeComponent(0, 0, 3, 2);
      const wire = makeWire(1, 1, 5, 1);
      setComponents(project, comp);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 20, 20), WorkMode.SELECT);

      const bb = manager.boundingBox();

      expect(bb).not.toBeNull();
      expect(bb!.x).toBe(0);
      expect(bb!.y).toBe(0);
      expect(bb!.right).toBe(6);
      expect(bb!.bottom).toBe(2);
    });

    it('skips destroyed components in the bounding box calculation', () => {
      const compAlive = makeComponent(5, 5, 2, 2);
      const compDead = makeComponent(0, 0, 10, 10);
      setComponents(project, compAlive, compDead);
      manager.commit(new Rectangle(0, 0, 20, 20), WorkMode.SELECT);

      // Destroy the large component after it was added to the selection.
      compDead.destroyed = true;

      const bb = manager.boundingBox();

      expect(bb).not.toBeNull();
      // Bounding box should only reflect compAlive.
      expect(bb!.x).toBe(5);
      expect(bb!.y).toBe(5);
      expect(bb!.width).toBe(2);
      expect(bb!.height).toBe(2);
    });

    it('returns null when all selected items are destroyed', () => {
      const comp = makeComponent(0, 0, 5, 5);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT);

      comp.destroyed = true;

      expect(manager.boundingBox()).toBeNull();
    });
  });

  // ── selectionChange$ emissions ─────────────────────────────────────────────

  describe('selectionChange$', () => {
    it('emits after a rect commit', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      // _commitRect calls this.clear() first (1 emit) then emits itself (1 emit).
      expect(emitCount).toBeGreaterThanOrEqual(1);
    });

    it('emits after a single-click commit', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      // _commitSingleClick calls this.clear() first (1 emit) then emits itself (1 emit).
      expect(emitCount).toBeGreaterThanOrEqual(1);
    });

    it('emits once after an explicit clear', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.clear();

      expect(emitCount).toBe(1);
    });

    it('emits after evict when the element was selected (uses real component)', () => {
      setStaticDIInjector(TestBed.inject(Injector));
      const comp = makeAnd(2);

      setComponents(project, comp);
      manager.commit(new Rectangle(-10, -10, 20, 20), WorkMode.SELECT);

      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.evict(comp);
      comp.destroy({ children: true });

      expect(emitCount).toBe(1);
    });

    it('does not emit after evict when the element was not selected', () => {
      const comp = makeComponent(99, 99, 1, 1); // never committed
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.evict(comp);

      expect(emitCount).toBe(0);
    });
  });
});
