import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { Direction } from '../../utils/direction';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { PastePlacementSession } from './paste-placement.session';
import { makeAnd, makeMoveInput, makeWire } from '../../../testing/factories';

function hasComponent(project: Project, comp: Component): boolean {
  return [...project.components].includes(comp);
}

function hasWire(project: Project, wire: Wire): boolean {
  return [...project.wires].includes(wire);
}

// ── PastePlacementSession ─────────────────────────────────────────────────────

describe('PastePlacementSession', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire | ConnectionPoint>;
  let session: PastePlacementSession | undefined;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    dragLayer = new Container();
  });

  afterEach(() => {
    // onCancel is safe to call; PixiJS destroy() is idempotent.
    // Tests that call onEnd() null out `session` to avoid double-destroy.
    session?.onCancel();
    session = undefined;
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  // ── constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('adds both components and wires to dragLayer', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      const wire = makeWire(5, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [comp], [wire]);
      expect(dragLayer.children).toContain(comp);
      expect(dragLayer.children).toContain(wire);
    });

    it('does not add elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect([...project.components]).toHaveLength(0);
    });
  });

  // ── selection rect ────────────────────────────────────────────────────────────

  describe('selection rect', () => {
    it('shows a rect around the padded group bounds while the ghosts float', () => {
      const show = vi.spyOn(project.floatingLayer, 'showSelectionRect');
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      expect(show).toHaveBeenCalledTimes(1);
      const rect = show.mock.calls[0][0];
      const bounds = comp.gridBounds;
      // Padded outward by GRAB_MARGIN on every side.
      expect(rect.x).toBe(bounds.x - 1);
      expect(rect.y).toBe(bounds.y - 1);
      expect(rect.width).toBe(bounds.width + 2);
      expect(rect.height).toBe(bounds.height + 2);
    });

    it('rides the rect along with the ghosts on move', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      const offset = vi.spyOn(project.floatingLayer, 'setSelectionRectOffset');

      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveInput(4, 3));

      expect(offset).toHaveBeenLastCalledWith(dragLayer.position);
      expect(dragLayer.position.x).toBe(4);
      expect(dragLayer.position.y).toBe(3);
    });

    it('re-fits the rect to the rotated bounds while keeping the drag offset', () => {
      // A tall 1×2 wire so a quarter turn changes the group's AABB.
      const wire = makeWire(0, 0, WireDirection.VERTICAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);

      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveInput(4, 0)); // offset = (4, 0)

      const show = vi.spyOn(project.floatingLayer, 'showSelectionRect');
      const offset = vi.spyOn(project.floatingLayer, 'setSelectionRectOffset');
      session.rotate(1);

      const rect = show.mock.calls[0][0];
      const bounds = wire.gridBounds; // now the rotated (horizontal) bounds
      expect(rect.x).toBe(bounds.x - 1);
      expect(rect.y).toBe(bounds.y - 1);
      expect(rect.width).toBe(bounds.width + 2);
      expect(rect.height).toBe(bounds.height + 2);
      expect(offset).toHaveBeenLastCalledWith(dragLayer.position);
      expect(dragLayer.position.x).toBe(4);
    });

    it('hides the rect when the paste is cancelled', () => {
      const hide = vi.spyOn(project.floatingLayer, 'hideSelectionRect');
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect(hide).toHaveBeenCalled();
    });
  });

  // ── canEnd / collision ───────────────────────────────────────────────────────

  describe('canEnd()', () => {
    it('returns true when no existing elements block the paste position', () => {
      const comp = makeAnd(2, Direction.E, 10, 10);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect(session.canEnd()).toBe(true);
    });

    it('returns false when a pasted component overlaps an existing component', () => {
      // Existing AND at (0,0); pasted AND also at (0,0).
      const existing = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(existing);

      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      expect(session.canEnd()).toBe(false);
    });

    it('returns true again after moving pasted component away from collision', () => {
      const existing = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(existing);

      const comp = makeAnd(2, Direction.E, 0, 0); // starts overlapping
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect(session.canEnd()).toBe(false);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveInput(10, 0)); // delta = (10,0) — clear of existing
      expect(session.canEnd()).toBe(true);
    });
  });

  // ── onMove / drag behaviour ──────────────────────────────────────────────────

  describe('onMove()', () => {
    it('does nothing before beginDrag() is called (hover phase)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.onMove(makeMoveInput(4, 0));

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('moves the dragLayer relative to the beginDrag anchor', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(2, 0)); // anchor at (2,0)
      session.onMove(makeMoveInput(5, 3)); // delta = (3,3)

      expect(dragLayer.position.x).toBe(3);
      expect(dragLayer.position.y).toBe(3);
    });

    it('snaps cursor to grid during drag', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveInput(2.7, 1.3));

      expect(dragLayer.position.x).toBe(3);
      expect(dragLayer.position.y).toBe(1);
    });

    it('isDragging is false before beginDrag, true after', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      expect(session.isDragging).toBe(false);
      session.beginDrag(new Point(0, 0));
      expect(session.isDragging).toBe(true);
    });
  });

  // ── re-grab after a frozen release ──────────────────────────────────────────

  describe('onInvalidRelease()', () => {
    it('leaves the ghosts put when the next press grabs them elsewhere', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      // Grabbed at (0,0), dragged 4 right, released onto a collision.
      session.onDown(makeMoveInput(0, 0));
      session.onMove(makeMoveInput(4, 0));
      session.onInvalidRelease();

      // Grabbed again at a different point of the group — the ghosts must not
      // slide under the first grab's anchor.
      session.onDown(makeMoveInput(5, 1));
      expect(dragLayer.position.x).toBe(4);
      expect(dragLayer.position.y).toBe(0);

      // ...and from there they follow the new grab point.
      session.onMove(makeMoveInput(7, 1));
      expect(dragLayer.position.x).toBe(6);
      expect(dragLayer.position.y).toBe(0);
    });
  });

  // ── moveBy ──────────────────────────────────────────────────────────────────

  describe('moveBy()', () => {
    it('shifts the waiting ghosts without a drag anchor', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.moveBy(1, 0);
      session.moveBy(0, -1);

      expect(dragLayer.position.x).toBe(1);
      expect(dragLayer.position.y).toBe(-1);
    });

    it('a moveBy mid-drag survives the next pointer move', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(2, 0));
      session.moveBy(0, 1);
      session.onMove(makeMoveInput(2, 0)); // the cursor has not moved

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(1);
    });
  });

  // ── onEnd ───────────────────────────────────────────────────────────────────

  describe('onEnd()', () => {
    it('adds components to the project at their final position', () => {
      const comp = makeAnd(2, Direction.E, 2, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveInput(3, 0)); // delta = (3,0)
      session.onEnd();
      session = undefined;

      expect(hasComponent(project, comp)).toBe(true);
      expect(comp.position.x).toBe(5); // 2 + 3 delta
      expect(comp.position.y).toBe(0);
    });

    it('adds wires to the project at their final position', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL); // position (0.5, 0.5)
      session = new PastePlacementSession(project, dragLayer, [], [wire]);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveInput(2, 0)); // delta = (2,0)
      session.onEnd();
      session = undefined;

      expect(hasWire(project, wire)).toBe(true);
      expect(wire.position.x).toBe(2.5); // 0.5 + 2
    });

    it('places elements at initial positions when no drag occurred', () => {
      const comp = makeAnd(2, Direction.E, 4, 2);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.onEnd();
      session = undefined;

      expect(hasComponent(project, comp)).toBe(true);
      expect(comp.position.x).toBe(4);
      expect(comp.position.y).toBe(2);
    });

    it('resets dragLayer position to (0,0) after commit', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveInput(3, 3));
      session.onEnd();
      session = undefined;

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('selects pasted components after commit', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      expect(project.selectionManager.selectedComponents.has(comp)).toBe(true);
    });

    it('selects pasted wires after commit', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);
      session.onEnd();
      session = undefined;

      expect(project.selectionManager.selectedWires.has(wire)).toBe(true);
    });

    it('records the paste in the action history (undoAvailable becomes true)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      expect(project.actionManager.undoAvailable).toBe(true);
    });

    it('undo removes pasted elements from the project', () => {
      const comp = makeAnd(2, Direction.E, 5, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      const compId = comp.id;
      project.actionManager.undo();

      expect(project.getComponentById(compId)).toBeUndefined();
    });

    it('redo re-adds pasted elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 5, 0);
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [comp], [wire]);
      session.onEnd();
      session = undefined;

      const compId = comp.id;
      const wireId = wire.id;
      project.actionManager.undo();
      project.actionManager.redo();

      expect(project.getComponentById(compId)).toBeDefined();
      expect([...project.wires].some((w) => w.id === wireId)).toBe(true);
    });
  });

  // ── onCancel ─────────────────────────────────────────────────────────────────

  // ── onEnd — wire integration ────────────────────────────────────────────────

  describe('onEnd() — wire integration', () => {
    it('merges a pasted wire overlapping an existing collinear wire', () => {
      project.addWire(makeWire(0, 0, WireDirection.HORIZONTAL, 4)); // 0.5..4.5
      const pasted = makeWire(2, 0, WireDirection.HORIZONTAL, 4); // 2.5..6.5
      session = new PastePlacementSession(project, dragLayer, [], [pasted]);
      session.onEnd();
      session = undefined;

      const wires = [...project.wires];
      expect(wires).toHaveLength(1);
      expect(wires[0].position.x).toBe(0.5);
      expect(wires[0].length).toBe(6);
    });

    it('splits an existing wire crossed by a pasted wire endpoint', () => {
      project.addWire(makeWire(0, 3, WireDirection.HORIZONTAL, 6)); // 0.5..6.5
      const stem = makeWire(3, 0, WireDirection.VERTICAL, 3); // ends at (3.5, 3.5)
      session = new PastePlacementSession(project, dragLayer, [], [stem]);
      session.onEnd();
      session = undefined;

      const wires = [...project.wires];
      expect(wires).toHaveLength(3);
      const horizontals = wires.filter(
        (w) => w.direction === WireDirection.HORIZONTAL
      );
      expect(horizontals.map((w) => w.length).sort()).toEqual([3, 3]);
    });

    it('merges two pasted collinear pieces touching end-to-end', () => {
      const left = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
      const right = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
      session = new PastePlacementSession(
        project,
        dragLayer,
        [],
        [left, right]
      );
      session.onEnd();
      session = undefined;

      const wires = [...project.wires];
      expect(wires).toHaveLength(1);
      expect(wires[0].length).toBe(6);
    });

    it('splits the wire under a pasted component port', () => {
      // AND at (4,1) facing East puts its input ports at (3.5, 1.5) and
      // (3.5, 2.5) — both on the vertical wire's interior.
      project.addWire(makeWire(3, 0, WireDirection.VERTICAL, 4)); // 0.5..4.5
      const comp = makeAnd(2, Direction.E, 4, 1);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      expect([...project.wires]).toHaveLength(3);
    });

    it('adopts the merge successor into the selection', () => {
      project.addWire(makeWire(0, 0, WireDirection.HORIZONTAL, 4));
      const pasted = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
      session = new PastePlacementSession(project, dragLayer, [], [pasted]);
      session.onEnd();
      session = undefined;

      const selected = [...project.selectionManager.selectedWires];
      expect(selected).toHaveLength(1);
      expect(selected[0].length).toBe(6);
    });

    it('does not select the split pieces of a crossed external wire', () => {
      project.addWire(makeWire(0, 3, WireDirection.HORIZONTAL, 6));
      const stem = makeWire(3, 0, WireDirection.VERTICAL, 3);
      session = new PastePlacementSession(project, dragLayer, [], [stem]);
      session.onEnd();
      session = undefined;

      const selected = [...project.selectionManager.selectedWires];
      expect(selected).toHaveLength(1);
      expect(selected[0].direction).toBe(WireDirection.VERTICAL);
    });

    it('undo restores the pre-paste wires exactly', () => {
      const existing = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
      project.addWire(existing);
      const existingId = existing.id;
      const pasted = makeWire(2, 0, WireDirection.HORIZONTAL, 4);
      session = new PastePlacementSession(project, dragLayer, [], [pasted]);
      session.onEnd();
      session = undefined;

      project.actionManager.undo();

      const wires = [...project.wires];
      expect(wires).toHaveLength(1);
      expect(wires[0].id).toBe(existingId);
      expect(wires[0].length).toBe(4);
    });
  });

  describe('onCancel()', () => {
    it('destroys all components', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect(comp.destroyed).toBe(true);
    });

    it('destroys all wires', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);
      session.onCancel();
      session = undefined;

      expect(wire.destroyed).toBe(true);
    });

    it('does not add elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect([...project.components]).toHaveLength(0);
    });

    it('resets dragLayer position to (0,0)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveInput(4, 3));
      session.onCancel();
      session = undefined;

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('does not record anything in the action history', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect(project.actionManager.undoAvailable).toBe(false);
    });
  });
});
