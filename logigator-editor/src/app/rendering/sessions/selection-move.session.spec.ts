import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Container, Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { Component } from '../../components/component';
import { SelectionMoveSession } from './selection-move.session';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { Direction } from '../../utils/direction';
import { makeAnd, makeMoveInput, makeWire } from '../../../testing/factories';
import { ThemingService } from '../../theming/theming.service';
import { getStaticDI } from '../../utils/get-di';

describe('SelectionMoveSession collision', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire>;
  // onEnd and onCancel are alternative terminal calls — a test that ends its
  // session must null this out so afterEach doesn't cancel a finished session
  // (restoring drag CPs the end already discarded).
  let session: SelectionMoveSession | undefined;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    dragLayer = new Container<Component | Wire>();
    session = undefined;
  });

  afterEach(() => {
    session?.onCancel();
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  describe('component movement', () => {
    it('canEnd() is false when component is moved onto another component', () => {
      // Stationary component at (5,0). Selected component at (0,0).
      const stationary = makeAnd();
      stationary.position.set(5, 0);
      project.addComponent(stationary);

      const selected = makeAnd();
      selected.position.set(0, 0);
      project.addComponent(selected);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        new Point(0, 0)
      );

      // Move selected component to (5,0) → overlaps stationary
      session.onMove(makeMoveInput(5, 0));
      expect(session.canEnd()).toBe(false);
    });

    it('canEnd() is false when component body is moved onto a wire — catches missing wire check bug', () => {
      // Wire in project at (5,0) len=3: gridBounds=[5,9)×[0,1).
      // Selected AND gate at (0,0): body Rectangle(0,0,2,2).
      // After move delta=(5,0): body world=Rectangle(5,0,2,2) → overlaps wire.
      const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);

      const selected = makeAnd();
      selected.position.set(0, 0);
      project.addComponent(selected);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        new Point(0, 0)
      );

      session.onMove(makeMoveInput(5, 0));
      expect(session.canEnd()).toBe(false);
      wire.destroy();
    });

    it('canEnd() is true when component is moved to clear space', () => {
      const wire = makeWire(5, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);

      const selected = makeAnd();
      selected.position.set(0, 0);
      project.addComponent(selected);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        new Point(0, 0)
      );

      // Move to (0,10) — far from the wire
      session.onMove(makeMoveInput(0, 10));
      expect(session.canEnd()).toBe(true);
      wire.destroy();
    });
  });

  describe('re-grab after a release the collision froze', () => {
    it('leaves the group put and follows the new grab point', () => {
      const blocker = makeAnd();
      blocker.position.set(5, 0);
      project.addComponent(blocker);

      const selected = makeAnd();
      selected.position.set(0, 0);
      project.addComponent(selected);
      project.selectionManager.select([selected], []);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        new Point(0, 0)
      );

      // Dragged onto the blocker and released: the group stays where it is.
      session.onMove(makeMoveInput(5, 0));
      expect(session.canEnd()).toBe(false);
      session.onInvalidRelease();
      expect(session.isAwaitingGrab()).toBe(true);

      // Grabbed again at a different point of the group: the press alone must
      // not shift it — before, the stale anchor pulled it under the cursor.
      expect(session.onDown(makeMoveInput(6, 1))).toBe(true);
      expect(dragLayer.position.x).toBe(5);
      expect(dragLayer.position.y).toBe(0);

      // From there it tracks the new grab point, not the old one.
      session.onMove(makeMoveInput(8, 1));
      expect(dragLayer.position.x).toBe(7);
      expect(dragLayer.position.y).toBe(0);
    });
  });

  describe('wire movement', () => {
    it('canEnd() is false when wire is moved onto a component body — catches missing wire check bug', () => {
      // Stationary component at (5,0): body Rectangle(5,0,2,2).
      // Selected wire at (0,0) HORIZONTAL len=3: gridBounds=[0,4)×[0,1).
      // After move delta=(5,0): wire world bounds=[5,9)×[0,1) → intersects body.
      const stationary = makeAnd();
      stationary.position.set(5, 0);
      project.addComponent(stationary);

      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([wire]),
        new Point(0, 0)
      );

      session.onMove(makeMoveInput(5, 0));
      expect(session.canEnd()).toBe(false);
    });

    it('canEnd() is true when wire is moved to clear space', () => {
      const stationary = makeAnd();
      stationary.position.set(5, 0);
      project.addComponent(stationary);

      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([wire]),
        new Point(0, 0)
      );

      // Move to (0,10) — clear of the component
      session.onMove(makeMoveInput(0, 10));
      expect(session.canEnd()).toBe(true);
    });

    it('canEnd() is false when wire is moved onto a component, then clears when moved away', () => {
      const stationary = makeAnd();
      stationary.position.set(5, 0);
      project.addComponent(stationary);

      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([wire]),
        new Point(0, 0)
      );

      session.onMove(makeMoveInput(5, 0));
      expect(session.canEnd()).toBe(false);

      session.onMove(makeMoveInput(0, 10));
      expect(session.canEnd()).toBe(true);
    });
  });

  // Regression: the CP selection must survive the commit. push() re-runs the
  // move do()s, whose remove-then-add termination cycle replaces the dot
  // instance at an exactly-3-termination junction; re-deriving the selection
  // before that leaves dead instances in the selection manager, so the dots
  // lose their highlight and stop being captured by subsequent drags.
  describe('connection points across moves', () => {
    it('keeps the junction dot selected after a move and carries it in the next drag', () => {
      // Three wires terminating at (5.5, 0.5) — exactly 3, so a CP exists.
      const w1 = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
      const w2 = makeWire(5, 0, WireDirection.HORIZONTAL, 5);
      const w3 = makeWire(5, 0, WireDirection.VERTICAL, 5);
      project.addWire(w1);
      project.addWire(w2);
      project.addWire(w3);

      project.selectionManager.commit(
        new Rectangle(0, 0, 11, 6),
        WorkMode.SELECT
      );
      expect(project.selectionManager.selectedConnectionPoints.length).toBe(1);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([w1, w2, w3]),
        new Point(0, 0)
      );
      session.onMove(makeMoveInput(0, 10));
      expect(session.canEnd()).toBe(true);
      session.onEnd();
      session = undefined;

      // The dot at the moved junction is the one the selection manager holds,
      // alive and highlighted.
      const cp = project.connectionPoints.getCpAt(new Point(5.5, 10.5));
      expect(cp).toBeDefined();
      expect(cp!.destroyed).toBe(false);
      expect(cp!.selected).toBe(true);
      expect(project.selectionManager.selectedConnectionPoints).toContain(cp);

      // A second drag captures that dot into the drag layer, so it rides
      // along with the selection instead of staying behind.
      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([w1, w2, w3]),
        new Point(0, 10)
      );
      expect(dragLayer.children).toContain(cp);
    });

    it('keeps the junction dot selected through undo and redo of the move', () => {
      const w1 = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
      const w2 = makeWire(5, 0, WireDirection.HORIZONTAL, 5);
      const w3 = makeWire(5, 0, WireDirection.VERTICAL, 5);
      project.addWire(w1);
      project.addWire(w2);
      project.addWire(w3);

      project.selectionManager.commit(
        new Rectangle(0, 0, 11, 6),
        WorkMode.SELECT
      );

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([w1, w2, w3]),
        new Point(0, 0)
      );
      session.onMove(makeMoveInput(0, 10));
      session.onEnd();
      session = undefined;

      // Undo moves the selection back; the dot at the original junction must
      // be the live, highlighted one the selection manager holds.
      project.actionManager.undo();
      const cpBack = project.connectionPoints.getCpAt(new Point(5.5, 0.5));
      expect(cpBack).toBeDefined();
      expect(cpBack!.selected).toBe(true);
      expect(project.selectionManager.selectedConnectionPoints).toContain(
        cpBack
      );

      // Redo moves it forward again.
      project.actionManager.redo();
      const cpFwd = project.connectionPoints.getCpAt(new Point(5.5, 10.5));
      expect(cpFwd).toBeDefined();
      expect(cpFwd!.selected).toBe(true);
      expect(project.selectionManager.selectedConnectionPoints).toContain(
        cpFwd
      );
    });
  });

  // Regression: SELECT_EXACT cut + move must not duplicate wires in the quad
  // tree. The cut materializes new pieces in-memory and registers as its own
  // history entry; the move commit coalesces that entry with the move's
  // container (record-without-do), so cut state is recorded exactly once and
  // cut + move undo as one step. This test catches a regression of that.
  describe('SELECT_EXACT cut + move (full flow)', () => {
    function allWires(): Wire[] {
      const huge = new Rectangle(-1000, -1000, 2000, 2000);
      return project.queryWiresInRange(huge);
    }

    it('produces no duplicate-ID wires after cut + move + push', () => {
      // Horizontal wire spanning (0.5, 0.5) → (10.5, 0.5).
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(wire);

      // Cut at integer rect (5,0)+(2,1): outside [0.5,4.5], inside [4.5,7.5], outside [7.5,10.5].
      project.selectionManager.commit(
        new Rectangle(5, 0, 2, 1),
        WorkMode.SELECT_EXACT
      );

      expect(project.selectionManager.hasLiveCut).toBe(true);
      expect(allWires().length).toBe(3);

      // Find the inside piece (the one selected).
      const insidePiece = Array.from(project.selectionManager.selectedWires)[0];
      expect(insidePiece).toBeDefined();

      // Drive a move on the inside piece. _pointerStart is one of the wire's
      // covered grid cells; onMove provides the post-move cursor position so
      // the delta lands on integer grid units.
      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([insidePiece]),
        new Point(5, 0)
      );
      // Move delta = (0, 5) — drag the inside piece down to a clear row.
      session.onMove(makeMoveInput(5, 5));
      expect(session.canEnd()).toBe(true);
      session.onEnd();
      session = undefined;

      // Cut+move materialized exactly three wires: two outside + one inside.
      const after = allWires();
      expect(after.length).toBe(3);

      // No duplicate IDs.
      const ids = after.map((w) => w.id);
      expect(new Set(ids).size).toBe(ids.length);

      // The cut was consumed and coalesced into the move's undo step.
      expect(project.selectionManager.hasLiveCut).toBe(false);
      expect(project.actionManager.history.length).toBe(1);

      // Undo restores the pre-cut state (the original wire).
      project.actionManager.undo();
      const undone = allWires();
      expect(undone.length).toBe(1);
      expect(undone[0].position.x).toBe(0.5);
      expect(undone[0].length).toBe(10);

      // Redo restores the post-move state.
      project.actionManager.redo();
      const redone = allWires();
      expect(redone.length).toBe(3);
      expect(new Set(redone.map((w) => w.id)).size).toBe(redone.length);
    });

    it('drag wire endpoint onto another wire interior splits the underlying wire', () => {
      // Long horizontal wire (1.5, 0.5)→(11.5, 0.5).
      const long = makeWire(1, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(long);
      // Vertical wire (0.5, -5.5)→(0.5, -0.5) — well clear of the H wire.
      const v = new Wire(WireDirection.VERTICAL, 5);
      v.position.set(0.5, -5.5);
      project.addWire(v);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([v]),
        new Point(0, -1)
      );
      // Move delta = (4, 1) so v ends up at (4.5, -4.5)→(4.5, 0.5).
      // v.end (4.5, 0.5) lands on long's interior.
      session.onMove(makeMoveInput(4, 0));
      expect(session.canEnd()).toBe(true);
      session.onEnd();
      session = undefined;

      const huge = new Rectangle(-100, -100, 200, 200);
      const wires = project.queryWiresInRange(huge);

      // long should be replaced by two halves.
      expect(wires.find((w) => w.id === long.id)).toBeUndefined();
      const horizontals = wires.filter(
        (w) => w.direction === WireDirection.HORIZONTAL
      );
      expect(horizontals.length).toBe(2);
      // CP at (4.5, 0.5).
      expect(project.connectionPoints.hasCpAt(new Point(4.5, 0.5))).toBe(true);
    });

    it('rolls back the tentative cut when the drag ends with no movement', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(wire);

      project.selectionManager.commit(
        new Rectangle(5, 0, 2, 1),
        WorkMode.SELECT_EXACT
      );

      expect(allWires().length).toBe(3);
      const insidePiece = Array.from(project.selectionManager.selectedWires)[0];

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([insidePiece]),
        new Point(5, 0)
      );
      // No onMove — delta stays at (0, 0).
      session.onEnd();
      session = undefined;

      // hasMove was false, so the session returned early without consuming.
      // The cut stays live (and stays the newest history entry).
      expect(project.selectionManager.hasLiveCut).toBe(true);
      expect(allWires().length).toBe(3);

      // A subsequent clear (e.g., the user clicks empty space) retracts it.
      project.selectionManager.clear();
      expect(project.selectionManager.hasLiveCut).toBe(false);
      const after = allWires();
      expect(after.length).toBe(1);
      expect(after[0].position.x).toBe(0.5);
      expect(after[0].length).toBe(10);

      // And the undo history is empty again — the retract removed the entry.
      expect(project.actionManager.undoAvailable).toBe(false);
    });

    it('undoes a live cut as one normal history step, redo re-applies it', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(wire);

      project.selectionManager.commit(
        new Rectangle(5, 0, 2, 1),
        WorkMode.SELECT_EXACT
      );
      expect(allWires().length).toBe(3);
      expect(project.actionManager.undoAvailable).toBe(true);

      // One Ctrl+Z reverts the whole cut; it stays redoable.
      project.actionManager.undo();
      const undone = allWires();
      expect(undone.length).toBe(1);
      expect(undone[0].length).toBe(10);
      expect(project.selectionManager.hasLiveCut).toBe(false);
      expect(project.actionManager.redoAvailable).toBe(true);

      project.actionManager.redo();
      expect(allWires().length).toBe(3);
    });

    it('dissolves a live cut when an unrelated action is recorded', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(wire);

      project.selectionManager.commit(
        new Rectangle(5, 0, 2, 1),
        WorkMode.SELECT_EXACT
      );
      expect(project.selectionManager.hasLiveCut).toBe(true);
      expect(allWires().length).toBe(3);

      // An unrelated operation (e.g. an option change from a side panel)
      // lands in the history: the selection clears and the cut retracts
      // first, so no orphaned split ever stays behind it.
      project.actionManager.push(
        new AddWiresAction(makeWire(0, 20, WireDirection.HORIZONTAL, 2))
      );

      expect(project.selectionManager.hasLiveCut).toBe(false);
      expect(project.selectionManager.isEmpty).toBe(true);
      // The original wire is whole again; only the unrelated wire was added.
      const wires = allWires();
      expect(wires.length).toBe(2);
      expect(wires.some((w) => w.length === 10)).toBe(true);
    });
  });

  describe('selection across integration', () => {
    it('keeps a moved wire selected when the commit merges it with an external wire', () => {
      // Selected wire (0.5,0.5)→(5.5,0.5); external wire (5.5,10.5)→(10.5,10.5).
      // Moving the selection down by 10 lands its end on the external start,
      // merging both into one wire — the selection must adopt the successor.
      const selected = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
      project.addWire(selected);
      const external = makeWire(5, 10, WireDirection.HORIZONTAL, 5);
      project.addWire(external);
      project.selectionManager.select([], [selected]);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([selected]),
        new Point(0, 0)
      );
      session.onMove(makeMoveInput(0, 10));
      session.onEnd();
      session = undefined;

      const wires = project.queryWiresInRange(
        new Rectangle(-100, -100, 200, 200)
      );
      expect(wires.length).toBe(1);
      const merged = wires[0];
      expect(merged.length).toBe(10);
      expect(merged.selected).toBe(true);
      expect([...project.selectionManager.selectedWires]).toEqual([merged]);

      // The frozen grab rect survives the transient eviction of the merged
      // original: still the select()-derived rect, translated by the move —
      // not re-fit to the longer merged wire and not dropped.
      expect(project.selectionManager.grabRect()).toEqual(
        new Rectangle(-1, 9, 8, 3)
      );
    });

    it('does not adopt the pieces of an external wire split by the arriving selection', () => {
      // Long horizontal wire (1.5, 0.5)→(11.5, 0.5); selected vertical wire
      // whose endpoint lands on its interior after the move, splitting it.
      const long = makeWire(1, 0, WireDirection.HORIZONTAL, 10);
      project.addWire(long);
      const v = new Wire(WireDirection.VERTICAL, 5);
      v.position.set(0.5, -5.5);
      project.addWire(v);
      project.selectionManager.select([], [v]);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set(),
        new Set([v]),
        new Point(0, -1)
      );
      session.onMove(makeMoveInput(4, 0));
      session.onEnd();
      session = undefined;

      // The moved wire survived and stays the whole selection; the split
      // pieces of the external wire only touch it at an endpoint.
      expect(v.selected).toBe(true);
      expect([...project.selectionManager.selectedWires]).toEqual([v]);
      const horizontals = project
        .queryWiresInRange(new Rectangle(-100, -100, 200, 200))
        .filter((w) => w.direction === WireDirection.HORIZONTAL);
      expect(horizontals.length).toBe(2);
      for (const piece of horizontals) {
        expect(piece.selected).toBe(false);
      }
      expect(project.selectionManager.grabRect()).not.toBeNull();
    });
  });

  describe('rotation', () => {
    it('turns a component+wire group rigidly, one undo step round-trips exactly', () => {
      // AND at (0,0) with a wire feeding its first input at (-0.5, 0.5).
      const comp = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(comp);
      const wire = makeWire(-4, 0, WireDirection.HORIZONTAL, 3);
      project.addWire(wire);
      project.selectionManager.select([comp], [wire]);

      // The rotate flow: session without a drag anchor, one CW turn, commit.
      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([comp]),
        new Set([wire]),
        null
      );
      session.rotate(1);
      expect(session.canEnd()).toBe(true);
      session.onEnd();
      session = undefined;

      // Rigid-body: the component turned E→S and the wire still terminates on
      // the same input port (group bounds (-4,0)+(6.5,2) → pivot (-1,1)).
      expect(comp.direction).toBe(Direction.S);
      expect(comp.position.x).toBe(0);
      expect(comp.position.y).toBe(2);
      expect(wire.direction).toBe(WireDirection.VERTICAL);
      expect(wire.position.x).toBe(-0.5);
      expect(wire.position.y).toBe(-1.5);
      expect(wire.length).toBe(3);
      const port = comp.connectionPoints[0];
      expect(port.x).toBe(-0.5);
      expect(port.y).toBe(1.5);

      // One history entry; undo restores the exact original geometry.
      expect(project.actionManager.history.length).toBe(1);
      project.actionManager.undo();
      expect(comp.direction).toBe(Direction.E);
      expect(comp.position.x).toBe(0);
      expect(comp.position.y).toBe(0);
      expect(wire.direction).toBe(WireDirection.HORIZONTAL);
      expect(wire.position.x).toBe(-3.5);
      expect(wire.position.y).toBe(0.5);

      // Redo re-applies the turn.
      project.actionManager.redo();
      expect(comp.direction).toBe(Direction.S);
      expect(wire.direction).toBe(WireDirection.VERTICAL);
      expect(wire.position.y).toBe(-1.5);
    });

    it('a colliding turn blocks the commit and cancel restores everything', () => {
      // Stationary AND with body (0,-2)..(2,0): clear of the selected AND's
      // E-direction extent, but overlapping its S-direction extent
      // (stubs swing from the left edge to the top edge).
      const stationary = makeAnd(2, Direction.E, 0, -2);
      project.addComponent(stationary);
      const selected = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(selected);
      project.selectionManager.select([selected], []);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        null
      );
      session.rotate(1);
      expect(session.canEnd()).toBe(false);

      session.onCancel();
      session = undefined;

      // Original pose restored, reattached, and no trace in the history.
      expect(selected.direction).toBe(Direction.E);
      expect(selected.position.x).toBe(0);
      expect(selected.position.y).toBe(0);
      expect(project.getComponentById(selected.id)).toBe(selected);
      expect(project.actionManager.undoAvailable).toBe(false);
    });

    it('keeps the invalid tint across a turn from colliding to still colliding', () => {
      // A stationary AND on the same footprint collides with the selected one
      // in every pose, so consecutive turns stay colliding throughout. Each
      // turn redraws the component (the direction setter rebuilds its
      // children, restoring the selection tint), so the collision state must
      // re-apply the invalid tint rather than only reacting to transitions.
      const stationary = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(stationary);
      const selected = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(selected);
      project.selectionManager.select([selected], []);
      const invalid = getStaticDI(ThemingService).currentTheme().invalid;

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        null
      );
      session.rotate(1);
      expect(session.canEnd()).toBe(false);
      expect(selected.tint).toBe(invalid);

      session.rotate(1);
      expect(session.canEnd()).toBe(false);
      expect(selected.tint).toBe(invalid);
    });

    it('four quarter-turns net to zero and commit nothing', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(comp);
      project.selectionManager.select([comp], []);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([comp]),
        new Set(),
        null
      );
      for (let i = 0; i < 4; i++) session.rotate(1);
      session.onEnd();
      session = undefined;

      expect(comp.direction).toBe(Direction.E);
      expect(comp.position.x).toBe(0);
      expect(comp.position.y).toBe(0);
      expect(project.actionManager.undoAvailable).toBe(false);
    });
  });

  describe('moveBy', () => {
    it('commits at the accumulated offset', () => {
      const selected = makeAnd();
      project.addComponent(selected);
      project.selectionManager.select([selected], []);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        null
      );
      session.moveBy(0, 1);
      session.moveBy(1, 0);
      expect(session.canEnd()).toBe(true);
      session.onEnd();
      session = undefined;

      expect(selected.position.x).toBe(1);
      expect(selected.position.y).toBe(1);
      expect(project.actionManager.undoAvailable).toBe(true);
    });

    it('a moveBy mid-drag survives the next pointer move', () => {
      const selected = makeAnd();
      project.addComponent(selected);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        new Point(0, 0)
      );
      session.moveBy(0, 1);
      session.onMove(makeMoveInput(0, 0)); // the cursor has not moved

      session.onEnd();
      session = undefined;

      expect(selected.position.x).toBe(0);
      expect(selected.position.y).toBe(1);
    });

    it('canEnd() is false when a moveBy lands on another component, true after moving back', () => {
      // Stationary body Rectangle(0,2,2,2); selected body Rectangle(0,0,2,2)
      // touches it edge-on — one step down makes them overlap.
      const stationary = makeAnd();
      stationary.position.set(0, 2);
      project.addComponent(stationary);

      const selected = makeAnd();
      project.addComponent(selected);

      session = new SelectionMoveSession(
        project,
        dragLayer,
        new Set([selected]),
        new Set(),
        null
      );
      session.moveBy(0, 1);
      expect(session.canEnd()).toBe(false);

      session.moveBy(0, -1);
      expect(session.canEnd()).toBe(true);
    });
  });
});
