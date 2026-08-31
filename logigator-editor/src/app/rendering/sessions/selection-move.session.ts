import { Container, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { Direction } from '@logigator/core';
import {
  normalizeRotationSteps,
  rotatePointAroundPivot,
  rotateRectAroundPivot,
  rotationPivotFor
} from '../../utils/rotation';
import { groupGridBounds, rotateElements } from './rotate-elements';
import { ActionContainer } from '../../actions/action-container';
import { MoveComponentsAction } from '../../actions/actions/move-components.action';
import { MoveWiresAction } from '../../actions/actions/move-wires.action';
import { RotateComponentsAction } from '../../actions/actions/rotate-components.action';
import { RotateWiresAction } from '../../actions/actions/rotate-wires.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { MoveEntry } from '../../actions/actions/move-entry.model';
import { SerializedWire } from '../../wires/serialized-wire.model';
import {
  SnapshotSpanIndex,
  WireSnapshot
} from '../../wires/wire-snapshot.model';
import { DragCollisionState } from './drag-collision';
import { getStaticDI } from '../../utils/get-di';
import { LoggingService } from '../../logging/logging.service';

/**
 * Drags — and turns — the committed selection. Opened either with a locked-in
 * `pointerStart` (the grab-and-move gesture) or with `pointerStart: null` by
 * the rotate flow, where the group floats until a press on it locks in the
 * anchor, so a rotation that collides can be repositioned before committing.
 *
 * {@link rotate} turns the floating group around its snapped centre and the
 * commit records rotate actions instead of moves. Original geometry is
 * captured at construction, so cancel restores it exactly.
 */
export class SelectionMoveSession implements DragSession {
  private readonly _components: Component[];
  private readonly _wires: Wire[];
  private _pointerStart: Point | null;
  private readonly _collision: DragCollisionState;
  private _capturedCps: ConnectionPoint[] = [];

  // Pre-session originals: rotate() mutates the detached elements in place,
  // so onEnd/onCancel cannot re-derive them.
  private readonly _wireSnapshots: SerializedWire[];
  private readonly _wireSnapshotsById: Map<number, SerializedWire>;
  private readonly _oldWireSnapshotsList: WireSnapshot[];
  private readonly _oldWireSnapshotsById: Map<number, WireSnapshot>;
  private readonly _componentOldPorts: Map<number, readonly Point[]>;
  private readonly _componentOldPos: Map<number, Point>;
  private readonly _componentOldDirection: Map<number, Direction>;
  private readonly _capturedCpOldPos: Map<ConnectionPoint, Point>;
  private readonly _originalGrabRect: Rectangle | null;

  // Net clockwise quarter-turns since construction (mod 4). Zero means the
  // commit/cancel paths treat the session as a pure move.
  private _netSteps = 0;

  constructor(
    private readonly project: Project,
    private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
    components: ReadonlySet<Component>,
    wires: ReadonlySet<Wire>,
    pointerStart: Point | null
  ) {
    this._components = [...components];
    this._wires = [...wires];
    this._pointerStart = pointerStart;

    project.detachForDrag(this._components, this._wires);
    for (const c of this._components) dragLayer.addChild(c);
    for (const w of this._wires) dragLayer.addChild(w);
    // dragLayer starts at offset (0,0) over a selection that was
    // non-overlapping, so no initial collision check is needed.
    this._collision = new DragCollisionState(
      project,
      dragLayer,
      this._components,
      this._wires
    );
    // Carry only the highlighted junctions, so what moves matches what looks
    // selected. The post-move recompute rebuilds the rest.
    this._capturedCps = project.connectionPoints.captureDragCps(
      this._components,
      this._wires,
      dragLayer,
      new Set(project.selectionManager.selectedConnectionPoints)
    );

    this._wireSnapshots = this._wires.map((w) => Wire.serialize(w));
    this._wireSnapshotsById = new Map<number, SerializedWire>(
      this._wireSnapshots.map((s) => [s.id, s])
    );
    this._oldWireSnapshotsList = this._wires.map((w) => Wire.snapshot(w));
    this._oldWireSnapshotsById = new Map<number, WireSnapshot>(
      this._wires.map((w, i) => [w.id, this._oldWireSnapshotsList[i]])
    );
    this._componentOldPorts = new Map(
      this._components.map((c) => [c.id, c.connectionPoints])
    );
    this._componentOldPos = new Map(
      this._components.map((c) => [c.id, c.position.clone()])
    );
    this._componentOldDirection = new Map(
      this._components.map((c) => [c.id, c.direction])
    );
    this._capturedCpOldPos = new Map(
      this._capturedCps.map((cp) => [cp, cp.position.clone()])
    );
    this._originalGrabRect = project.selectionManager.grabRect();
  }

  /**
   * A press while the session floats without an anchor: on the selection it
   * locks the anchor in, off it asks the router to cancel. Presses with an
   * anchor already locked are consumed and ignored.
   */
  onDown(input: PointerInput): boolean {
    if (this._pointerStart) return true;
    const offset = this.dragLayer.position;
    // Hit-test and anchor in element space: subtracting the layer offset maps
    // the cursor onto the stored element positions.
    const local = new Point(input.grid.x - offset.x, input.grid.y - offset.y);
    if (!this.project.selectionManager.isGrabbedAt(local)) return false;
    const gridPos = roundToGrid(input.grid);
    this._pointerStart = new Point(gridPos.x - offset.x, gridPos.y - offset.y);
    return true;
  }

  /**
   * The drop landed on a collision, so the group keeps floating. Releasing the
   * anchor puts the session back to awaiting a grab.
   */
  onInvalidRelease(): void {
    this._pointerStart = null;
  }

  onMove(input: PointerInput): void {
    if (!this._pointerStart) return;
    const gridPos = roundToGrid(input.grid, true);
    const x = gridPos.x - this._pointerStart.x;
    const y = gridPos.y - this._pointerStart.y;
    // Ghosts only ever sit on the grid, so an unchanged offset has nothing to
    // redraw and nothing new to collide with.
    const position = this.dragLayer.position;
    if (position.x === x && position.y === y) return;
    position.set(x, y);
    this.project.floatingLayer.setSelectionRectOffset(position);
    this._collision.update();
  }

  /**
   * Shifts the floating group by (dx, dy) grid units. With a drag anchor
   * locked, the anchor shifts opposite so the next pointer move preserves the
   * offset instead of snapping the group back under the cursor.
   */
  moveBy(dx: number, dy: number): void {
    this.dragLayer.position.set(
      this.dragLayer.position.x + dx,
      this.dragLayer.position.y + dy
    );
    this._pointerStart?.set(
      this._pointerStart.x - dx,
      this._pointerStart.y - dy
    );
    this.project.floatingLayer.setSelectionRectOffset(this.dragLayer.position);
    this._collision.update();
  }

  /**
   * Turns the floating group clockwise by `steps` quarter-turns around its
   * snapped centre, in element space, so the drag offset translates the
   * result. Carried junction dots and the frozen grab rect turn with it.
   */
  rotate(steps: number): void {
    const s = normalizeRotationSteps(steps);
    if (s === 0) return;
    const bounds = groupGridBounds(this._components, this._wires);
    if (!bounds) return;
    const pivot = rotationPivotFor(bounds);

    // Before the elements move: grabRect() translates the frozen rect by how
    // far the bounding box has drifted.
    const rect = this.project.selectionManager.grabRect();

    rotateElements(this._components, this._wires, pivot, s);
    for (const cp of this._capturedCps) {
      cp.position.copyFrom(rotatePointAroundPivot(pivot, cp.position, s));
    }
    this._netSteps = (this._netSteps + s) % 4;

    if (rect) {
      this.project.selectionManager.freezeGrabRect(
        rotateRectAroundPivot(pivot, rect, s)
      );
      // The freeze redraws at base position; re-apply the drag offset.
      this.project.floatingLayer.setSelectionRectOffset(
        this.dragLayer.position
      );
    }
    this._collision.update();
  }

  /**
   * Floating without a drag anchor. The router auto-commits such a session
   * once a discrete rotate/move clears the collision; once grabbed this turns
   * false, so a rotate mid-drag does not commit under the cursor.
   */
  isAwaitingGrab(): boolean {
    return this._pointerStart === null;
  }

  canEnd(): boolean {
    return !this._collision.hasCollision;
  }

  onEnd(): void {
    const delta = this.dragLayer.position.clone();
    const hasMove = delta.x !== 0 || delta.y !== 0;
    const hasRotation = this._netSteps !== 0;

    for (const child of this.dragLayer.children) {
      if (child instanceof ConnectionPoint) continue;
      child.position.set(
        child.position.x + delta.x,
        child.position.y + delta.y
      );
    }

    this.dragLayer.position.set(0, 0);
    this._collision.reset();
    // Back to base; the actionChange$ redraw re-places it at the moved bounds.
    this.project.floatingLayer.setSelectionRectOffset(this.dragLayer.position);
    // Emptied in one pass before the elements go back: re-parenting drops each
    // one by index scan, so reattaching in place would search a layer still
    // holding the rest. Both paths below take the junction dots parentless.
    this.dragLayer.removeChildren();
    this.project.reattachFromDrag(this._components, this._wires);

    if (!hasMove && !hasRotation) {
      getStaticDI(LoggingService).debug(
        'ended move with zero delta: nothing committed',
        'SelectionMoveSession'
      );
      this.project.connectionPoints.restoreDragCps(this._capturedCps);
      return;
    }

    this.project.connectionPoints.discardDragCps(this._capturedCps);

    // The integrator may split wires whose interiors a moved port/endpoint now
    // crosses, and merge wires at old positions it no longer blocks.
    const { toAdd, toRemove } = this.project.topology.integrate({
      movedWires: this._wires.map((w) => ({
        wire: w,
        oldSnapshot: this._oldWireSnapshotsById.get(w.id)!
      })),
      movedComponentPorts: this._components.map((c) => ({
        oldPorts: this._componentOldPorts.get(c.id)!,
        newPorts: c.connectionPoints
      }))
    });

    this.project.connectionPoints.recomputeCpsForMovedSelection(
      this._componentOldPorts,
      this._oldWireSnapshotsList,
      this._components,
      this._wires
    );

    const action = new ActionContainer();

    if (this._components.length > 0) {
      if (hasRotation) {
        action.add(
          new RotateComponentsAction(
            ...this._components.map((c) => ({
              id: c.id,
              oldPos: this._componentOldPos.get(c.id)!,
              newPos: c.position.clone(),
              oldDirection: this._componentOldDirection.get(c.id)!,
              newDirection: c.direction
            }))
          )
        );
      } else {
        const componentEntries: MoveEntry[] = this._components.map((c) => ({
          id: c.id,
          oldPos: this._componentOldPos.get(c.id)!,
          newPos: c.position.clone()
        }));
        action.add(new MoveComponentsAction(...componentEntries));
      }
    }

    // A survived wire records its own geometry change; rotation swaps the axis
    // on odd steps, so those record as rotate entries instead of moves.
    const addSurvivedWireActions = (survived: Wire[]): void => {
      if (survived.length === 0) return;
      if (hasRotation) {
        action.add(
          new RotateWiresAction(
            ...survived.map((w) => {
              const snap = this._wireSnapshotsById.get(w.id)!;
              return {
                id: w.id,
                oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
                newPos: w.position.clone(),
                oldDirection: snap.direction,
                newDirection: w.direction
              };
            })
          )
        );
      } else {
        const entries: MoveEntry[] = survived.map((w) => {
          const snap = this._wireSnapshotsById.get(w.id)!;
          return {
            id: w.id,
            oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
            newPos: w.position.clone()
          };
        });
        action.add(new MoveWiresAction(...entries));
      }
    };

    if (toRemove.length > 0) {
      const removedIds = new Set(toRemove.map((w) => w.id));
      const movedIds = new Set(this._wires.map((w) => w.id));

      addSurvivedWireActions(this._wires.filter((w) => !removedIds.has(w.id)));

      // Serialize at OLD geometry so undo restores them where they came from.
      const movedAndChangedSnapshots = this._wireSnapshots.filter((s) =>
        removedIds.has(s.id)
      );
      // Absorbed or split externals, at their current positions.
      const externalAbsorbed = toRemove.filter((w) => !movedIds.has(w.id));
      const externalAbsorbedSnapshots = externalAbsorbed.map((w) =>
        Wire.serialize(w)
      );

      action.add(
        new RemoveWiresAction(
          ...movedAndChangedSnapshots,
          ...externalAbsorbedSnapshots
        )
      );
      action.add(new AddWiresAction(...toAdd));
    } else {
      addSurvivedWireActions(this._wires);
    }

    // Both must be read before the removals: those destroy the replaced
    // instances that decide which wires the selection adopts, and evict the
    // originals the grab rect's translation anchors to.
    const movedFinalSpans = new SnapshotSpanIndex(
      this._wires.map((w) => Wire.snapshot(w))
    );
    const grabRectBeforeIntegration = this.project.selectionManager.grabRect();

    // Materialize the integrator's changes on the live instances, then
    // register — the recorded action never re-runs against this state.
    for (const w of toRemove) this.project.removeWire(w.id);
    for (const w of toAdd) this.project.addWire(w);

    if (toRemove.length > 0 || toAdd.length > 0) {
      // A replacement sharing a span with a moved wire is its merge/split
      // successor and joins the selection; an external wire's split pieces
      // only touch at an endpoint and stay out.
      this.project.selectionManager.adoptWires(
        toAdd.filter((w) => movedFinalSpans.sharesSpan(Wire.snapshot(w)))
      );
      this.project.selectionManager.freezeGrabRect(grabRectBeforeIntegration);
    }

    getStaticDI(LoggingService).debug(
      `committed move: ${this._components.length} component(s) and ${this._wires.length} wire(s) moved (${this._netSteps} quarter-turn(s)); ` +
        `integration added ${toAdd.length} and removed ${toRemove.length} wire(s)`,
      'SelectionMoveSession'
    );

    if (action.length > 0) {
      // A drag from a SELECT_EXACT scissor selection commits the cut, folding
      // its history entry and this move into one undo step. A zero-change end
      // returns earlier, leaving the cut live for the next clear to retract.
      const cut = this.project.selectionManager.consumeLiveCut();
      if (cut) {
        this.project.actionManager.coalesceTop(cut, action);
      } else {
        this.project.actionManager.register(action);
      }
    }

    // Only after the commit: the removals cycle terminations and recreate the
    // dot at any exactly-3-termination point, so a CP selected earlier is a
    // dead instance the next drag's capture set would miss.
    this.project.selectionManager.retintCps();
  }

  onCancel(): void {
    getStaticDI(LoggingService).debug(
      `cancelled move: ${this._components.length} component(s) and ${this._wires.length} wire(s) reattached at their original positions`,
      'SelectionMoveSession'
    );
    if (this._netSteps !== 0) {
      // Before reattaching, so termination counts and the frozen rect land
      // back on the original geometry.
      for (const c of this._components) {
        c.direction = this._componentOldDirection.get(c.id)!;
        c.position.copyFrom(this._componentOldPos.get(c.id)!);
      }
      for (const w of this._wires) {
        const snap = this._oldWireSnapshotsById.get(w.id)!;
        w.direction = snap.direction;
        w.position.set(snap.start.x, snap.start.y);
      }
      for (const cp of this._capturedCps) {
        cp.position.copyFrom(this._capturedCpOldPos.get(cp)!);
      }
      this.project.selectionManager.freezeGrabRect(this._originalGrabRect);
    }
    this.dragLayer.position.set(0, 0);
    this._collision.reset();
    // Bounds are unchanged on cancel, so returning to base is enough.
    this.project.floatingLayer.setSelectionRectOffset(this.dragLayer.position);
    this.dragLayer.removeChildren();
    this.project.reattachFromDrag(this._components, this._wires);
    this.project.connectionPoints.restoreDragCps(this._capturedCps);
  }
}
