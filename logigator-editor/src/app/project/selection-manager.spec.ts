import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { SelectionManager } from './selection-manager';
import { WorkMode } from '../work-mode/work-mode.enum';
import { setStaticDIInjector } from '../utils/get-di';
import { WireDirection } from '@logigator/core';
import { ActionContainer } from '../actions/action-container';
import type { Project } from './project';
import { makeAnd } from '../../testing/factories';
import { AndComponent } from '../components/component-types/and/and.component';

/**
 * A plain object suffices everywhere except `evict()`, the only path that uses
 * `instanceof Component`; those tests use a real AndComponent.
 */
function makeComponent(x: number, y: number, w: number, h: number): any {
  return {
    selected: false,
    destroyed: false,
    connectionPoints: [] as Point[],
    get gridBounds() {
      return new Rectangle(x, y, w, h);
    }
  };
}

function makeWire(x: number, y: number, w: number, h: number): any {
  return {
    selected: false,
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
 * Also exposes position/direction/length so cutWire() can inspect it.
 * gridBounds mirrors Wire.gridBounds: floor(position) extended by 1 on the
 * spanning axis.
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
    selected: false,
    destroyed: false,
    direction,
    position: pos,
    length,
    gridBounds,
    connectionPoints: [pos, endPoint] as [Point, Point]
  };
}

/** A fresh array per call, matching the real query's snapshot semantics. */
function setComponents(project: MockedObject<Project>, ...items: any[]): void {
  project.queryComponentsInRange.mockImplementation(() => [...items]);
}

function setWires(project: MockedObject<Project>, ...items: any[]): void {
  project.queryWiresInRange.mockImplementation(() => [...items]);
}

function makeProject(): MockedObject<Project> {
  const project = {
    queryComponentsInRange: vi.fn().mockName('Project.queryComponentsInRange'),
    queryWiresInRange: vi.fn().mockName('Project.queryWiresInRange'),
    addWire: vi.fn().mockName('Project.addWire'),
    removeWire: vi.fn().mockName('Project.removeWire')
  };
  // Enough of the history contract — topDone tracking, retract running the
  // action's undo — for hasLiveCut and clear() to behave.
  const actionManager = {
    topDone: null as unknown,
    push: vi.fn().mockName('ActionManager.push'),
    register: vi.fn().mockName('ActionManager.register'),
    retract: vi.fn().mockName('ActionManager.retract'),
    onBeforeRecord: vi.fn().mockName('ActionManager.onBeforeRecord')
  };
  actionManager.onBeforeRecord.mockReturnValue(() => undefined);
  actionManager.register.mockImplementation((action: unknown) => {
    actionManager.topDone = action;
  });
  actionManager.retract.mockImplementation((action: any) => {
    if (actionManager.topDone !== action) return false;
    action.undo(project);
    actionManager.topDone = null;
    return true;
  });
  (project as any).actionManager = actionManager;
  (project as any).connectionPoints = {
    getCpsAtPoints: vi.fn().mockReturnValue([])
  };

  return project as unknown as MockedObject<Project>;
}

describe('SelectionManager', () => {
  let project: MockedObject<Project>;
  let manager: SelectionManager;

  beforeEach(() => {
    project = makeProject();
    setComponents(project);
    setWires(project);
    manager = new SelectionManager(project);
  });

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
  });

  describe('commit — rect mode (SELECT)', () => {
    it('adds components returned by queryComponentsInRange to selectedComponents', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
    });

    it('flags selected components as selected', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(comp.selected).toBe(true);
    });

    it('adds wires returned by queryWiresInRange to selectedWires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.selectedWires.has(wire)).toBe(true);
    });

    it('flags selected wires as selected', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(wire.selected).toBe(true);
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
      // The previously selected component loses its highlight.
      expect(compA.selected).toBe(false);
    });

    it('isEmpty becomes false after committing with results', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(manager.isEmpty).toBe(false);
    });
  });

  // SELECT_EXACT selects on the same intersect rule as SELECT, but also
  // scissors wires extending past the rect at the boundary.
  describe('commit — SELECT_EXACT mode', () => {
    it('includes a component fully inside the rect', () => {
      const comp = makeComponent(2, 2, 3, 3);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 10, 10), WorkMode.SELECT_EXACT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
    });

    it('includes a component that partially overlaps the rect boundary (touching rule)', () => {
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

      it('registers the cut as a live history entry when a wire crosses the rect boundary', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);

        expect((project as any).actionManager.push).not.toHaveBeenCalled();
        expect((project as any).actionManager.register).toHaveBeenCalledTimes(
          1
        );
        expect(manager.hasLiveCut).toBe(true);
      });

      it('mutates the project directly with addWire/removeWire when cutting', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);

        // The rect cuts the wire into outside-left, inside, outside-right.
        expect(project.removeWire).toHaveBeenCalledTimes(1);
        expect(project.addWire).toHaveBeenCalledTimes(3);
      });

      it('does not push an action when the only wire is fully inside the rect', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 1.5, 1.5, 2);
        setWires(project, wire);

        manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT_EXACT);

        expect((project as any).actionManager.push).not.toHaveBeenCalled();
      });

      // With non-integer rect bounds, an outside piece's half-cell gridBounds
      // padding still intersects the rect under PixiJS' strict-< rule, so
      // inside pieces must come from the cut's own bookkeeping, not a re-query.
      it('selects only the inside piece when the rect has non-integer bounds', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
        setWires(project, wire);

        const addedWires: any[] = [];
        project.addWire.mockImplementation((w: any) => {
          addedWires.push(w);
        });

        manager.commit(new Rectangle(4.7, 4, 2.6, 1), WorkMode.SELECT_EXACT);

        expect(addedWires.length).toBe(3);

        const insidePiece = addedWires.find((w) => w.position.x === 4.5);
        const outsideLeft = addedWires.find((w) => w.position.x === 0.5);
        const outsideRight = addedWires.find((w) => w.position.x === 7.5);

        expect(insidePiece).toBeDefined();
        expect(outsideLeft).toBeDefined();
        expect(outsideRight).toBeDefined();

        expect(manager.selectedWires.has(insidePiece)).toBe(true);
        expect(manager.selectedWires.has(outsideLeft)).toBe(false);
        expect(manager.selectedWires.has(outsideRight)).toBe(false);

        expect(insidePiece.selected).toBe(true);
        expect(outsideLeft.selected).toBe(false);
        expect(outsideRight.selected).toBe(false);
      });

      it('clear() retracts the live cut: adds originals back, removes pieces', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasLiveCut).toBe(true);

        project.addWire.mockClear();
        project.removeWire.mockClear();

        manager.clear();

        expect(manager.hasLiveCut).toBe(false);
        expect((project as any).actionManager.retract).toHaveBeenCalledTimes(1);
        expect(project.removeWire).toHaveBeenCalledTimes(3);
        expect(project.addWire).toHaveBeenCalledTimes(1);
      });

      it('consumeLiveCut hands over the registered container and clears the live state', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasLiveCut).toBe(true);

        project.addWire.mockClear();
        project.removeWire.mockClear();

        const consumed = manager.consumeLiveCut();

        expect(consumed).toBeInstanceOf(ActionContainer);
        expect(consumed).toBe(
          (project as any).actionManager.register.mock.calls[0][0]
        );
        expect(manager.hasLiveCut).toBe(false);
        // Consuming does not mutate the project; the committing action does.
        expect(project.removeWire).not.toHaveBeenCalled();
        expect(project.addWire).not.toHaveBeenCalled();
        manager.clear();
        expect((project as any).actionManager.retract).not.toHaveBeenCalled();
      });

      it('consumeLiveCut returns null when no cut is live', () => {
        expect(manager.consumeLiveCut()).toBeNull();
      });

      it('a cut stops being live once another entry lands on top of it', () => {
        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);

        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasLiveCut).toBe(true);

        (project as any).actionManager.topDone = {};

        expect(manager.hasLiveCut).toBe(false);
        expect(manager.consumeLiveCut()).toBeNull();

        // The retract reports non-top and reverts nothing.
        project.addWire.mockClear();
        project.removeWire.mockClear();
        manager.clear();
        expect(project.removeWire).not.toHaveBeenCalled();
        expect(project.addWire).not.toHaveBeenCalled();
      });

      it('the installed pre-record hook dissolves a live cut and no-ops otherwise', () => {
        const hook = (project as any).actionManager.onBeforeRecord.mock
          .calls[0][0] as () => void;

        hook();
        expect((project as any).actionManager.retract).not.toHaveBeenCalled();

        const wire = makeFullWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
        setWires(project, wire);
        manager.commit(new Rectangle(5, 4, 2, 1), WorkMode.SELECT_EXACT);
        expect(manager.hasLiveCut).toBe(true);

        hook();
        expect(manager.hasLiveCut).toBe(false);
        expect(manager.isEmpty).toBe(true);
        expect((project as any).actionManager.retract).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('commit — single click (zero-size rect)', () => {
    it('selects a component whose gridBounds contains the click point', () => {
      const comp = makeComponent(2, 2, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(comp.selected).toBe(true);
    });

    it('selects a wire when no component is at the click point', () => {
      const wire = makeWire(0, 3, 5, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(2, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedWires.has(wire)).toBe(true);
      expect(wire.selected).toBe(true);
    });

    it('prefers the component over a wire when the component has a smaller bounding area', () => {
      const comp = makeComponent(3, 3, 1, 1); // area=1; contains (3,3)
      const wire = makeWire(0, 2, 5, 2); // area=10; contains (3,3)
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(manager.selectedWires.has(wire)).toBe(false);
    });

    it('selects the wire when the wire has a smaller area than the component', () => {
      const comp = makeComponent(1, 1, 4, 4); // area=16; contains (3,3)
      const wire = makeWire(3, 3, 1, 1); // area=1;  contains (3,3)
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(false);
      expect(manager.selectedWires.has(wire)).toBe(true);
    });

    it('selects nothing when the click point is in empty space', () => {
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
      // Equal areas: the component wins the <= tie-break.
      const comp = makeComponent(3, 3, 1, 1);
      const wire = makeWire(3, 3, 1, 1);
      setComponents(project, comp);
      setWires(project, wire);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.has(comp)).toBe(true);
      expect(manager.selectedWires.has(wire)).toBe(false);
    });
  });

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

    it('deselects non-destroyed components', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);
      expect(comp.selected).toBe(true);

      manager.clear();

      expect(comp.selected).toBe(false);
    });

    it('deselects non-destroyed wires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(wire.selected).toBe(false);
    });

    it('skips deselection for destroyed components', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      comp.destroyed = true;

      manager.clear();

      expect(comp.selected).toBe(true);
    });

    it('skips deselection for destroyed wires', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      wire.destroyed = true;

      manager.clear();

      expect(wire.selected).toBe(true);
    });

    it('isEmpty is true after clear', () => {
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      manager.clear();

      expect(manager.isEmpty).toBe(true);
    });
  });

  // evict() splits the two sets with `instanceof Component`, so these need
  // real AndComponent instances.
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

  describe('grabRect / isGrabbedAt', () => {
    it('returns null when selection is empty', () => {
      expect(manager.grabRect()).toBeNull();
      expect(manager.isGrabbedAt({ x: 0, y: 0 })).toBe(false);
    });

    it('freezes the marquee exactly as drawn instead of re-fitting to content', () => {
      const comp = makeComponent(2, 3, 4, 5);
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 20, 20), WorkMode.SELECT);

      const rect = manager.grabRect()!;

      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(20);
      expect(rect.height).toBe(20);
      expect(manager.isGrabbedAt({ x: 15, y: 15 })).toBe(true);
      expect(manager.isGrabbedAt({ x: 25, y: 25 })).toBe(false);
    });

    it('translates the frozen rect with the selection bounds without resizing', () => {
      // Mutable bounds stand in for a committed move.
      const pos = new Point(2, 3);
      const comp: any = {
        selected: false,
        destroyed: false,
        connectionPoints: [] as Point[],
        get gridBounds() {
          return new Rectangle(pos.x, pos.y, 4, 5);
        }
      };
      setComponents(project, comp);
      manager.commit(new Rectangle(0, 0, 20, 20), WorkMode.SELECT);

      pos.set(9, 3); // bounds moved +7 in x

      const rect = manager.grabRect()!;
      expect(rect.x).toBe(7);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(20);
      expect(rect.height).toBe(20);
    });

    it('gives a single-click selection no rect but element-bounds grabbing', () => {
      const comp = makeComponent(2, 3, 4, 5); // bounds (2,3)–(6,8)
      setComponents(project, comp);
      // Zero-size rect = the single-click commit path.
      manager.commit(new Rectangle(4, 4, 0, 0), WorkMode.SELECT);

      expect(manager.selectedComponents.size).toBe(1);
      expect(manager.grabRect()).toBeNull();
      expect(manager.isGrabbedAt({ x: 3, y: 4 })).toBe(true); // on the element
      expect(manager.isGrabbedAt({ x: 1, y: 1 })).toBe(false); // off the element
    });

    it('rects a programmatic select() at padded content bounds', () => {
      const comp = makeComponent(2, 3, 4, 5); // bounds (2,3)–(6,8)
      manager.select([comp], []);

      const rect = manager.grabRect()!;

      const m = SelectionManager.GRAB_MARGIN;
      expect(rect.x).toBe(2 - m);
      expect(rect.y).toBe(3 - m);
      expect(rect.right).toBe(6 + m);
      expect(rect.bottom).toBe(8 + m);
    });
  });

  // A junction dot is highlighted only when the selection rect touches its
  // grid cell, so selecting a wire never drags in endpoint junctions that may
  // connect to unselected wires.
  describe('retintCps', () => {
    it('looks up only the endpoints whose grid cell the rect touches', () => {
      const wire = makeWire(0, 0, 11, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(project.connectionPoints.getCpsAtPoints).toHaveBeenCalledWith([
        new Point(0, 0)
      ]);
    });

    it('selects a junction when the rect grazes its cell but stops short of its centre', () => {
      // Centre (5.5, 0.5) → cell (5,0)–(6,1); the other cell is out of reach.
      const wire: any = {
        selected: false,
        destroyed: false,
        connectionPoints: [new Point(5.5, 0.5), new Point(5.5, 6.5)],
        get gridBounds() {
          return new Rectangle(5, 0, 1, 7);
        }
      };
      setWires(project, wire);

      manager.commit(new Rectangle(0, 0, 5.5, 5), WorkMode.SELECT);

      expect(project.connectionPoints.getCpsAtPoints).toHaveBeenCalledWith([
        new Point(5.5, 0.5)
      ]);
    });

    it('never highlights junctions for a rect-less single-click selection', () => {
      const wire = makeWire(0, 0, 3, 1);
      setWires(project, wire);

      manager.commit(new Rectangle(2, 0, 0, 0), WorkMode.SELECT);

      const calls = (project.connectionPoints.getCpsAtPoints as any).mock.calls;
      expect(calls.every((c: any[]) => c[0].length === 0)).toBe(true);
    });
  });

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

      compDead.destroyed = true;

      const bb = manager.boundingBox();

      expect(bb).not.toBeNull();
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

  describe('selectionChange$', () => {
    it('emits after a rect commit', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);
      const comp = makeComponent(0, 0, 2, 2);
      setComponents(project, comp);

      manager.commit(new Rectangle(0, 0, 5, 5), WorkMode.SELECT);

      expect(emitCount).toBeGreaterThanOrEqual(1);
    });

    it('emits after a single-click commit', () => {
      let emitCount = 0;
      manager.selectionChange$.subscribe(() => emitCount++);

      manager.commit(new Rectangle(3, 3, 0, 0), WorkMode.SELECT);

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
