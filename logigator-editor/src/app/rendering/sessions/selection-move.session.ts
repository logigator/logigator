import { Container, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { Direction } from '../../utils/direction';
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
  snapshotsShareSpan,
  WireSnapshot
} from '../../wires/wire-snapshot.model';
import { DragCollisionState } from './drag-collision';
import { getStaticDI } from '../../utils/get-di';
import { LoggingService } from '../../logging/logging.service';

/**
 * Drags — and turns — the committed selection. Opened two ways:
 *
 * - By the select tool with a locked-in `pointerStart`: the classic grab-and-
 *   move gesture.
 * - By the rotate flow with `pointerStart: null`: the session outlives its
 *   (non-existent) opening gesture like paste placement does — the rotated
 *   group floats in place until a press on it locks in the drag anchor, so a
 *   rotation that collides can be repositioned before it commits.
 *
 * Rotation ({@link rotate}) turns the floating group around its snapped
 * centre; the commit then records rotate actions instead of moves. Original
 * geometry is captured at construction, so cancel restores it exactly.
 */
export class SelectionMoveSession implements DragSession {
  private readonly _components: Component[];
  private readonly _wires: Wire[];
  private _pointerStart: Point | null;
  private readonly _collision: DragCollisionState;
  private _capturedCps: ConnectionPoint[] = [];

  // Pre-session originals. Captured at construction — rotate() mutates the
  // detached elements in place, so onEnd/onCancel cannot re-derive them later.
  private readonly _wireSnapshots: SerializedWire[];
  private readonly _oldWireSnapshotsList: WireSnapshot[];
  private readonly _oldWireSnapshotsById: Map<number, WireSnapshot>;
  private readonly _componentOldPorts: Map<number, readonly Point[]>;
  private readonly _componentOldPos: Map<number, Point>;
  private readonly _componentOldDirection: Map<number, Direction>;
  private readonly _capturedCpOldPos: Map<ConnectionPoint, Point>;
  private readonly _originalGrabRect: Rectangle | null;

  // Net clockwise quarter-turns applied since construction (mod 4). Zero
  // means the commit/cancel paths can treat the session as a pure move.
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
    // dragLayer starts at (0,0) offset; selection was non-overlapping before
    // detach, so no initial collision check is needed. (The rotate flow calls
    // rotate() right after construction, which runs its own check.)
    this._collision = new DragCollisionState(
      project,
      dragLayer,
      this._components,
      this._wires
    );
    // Carry only the highlighted junctions, so what moves matches what looks
    // selected. A junction connecting the selection to unselected wires is not
    // highlighted and stays put; the post-move recompute rebuilds it.
    this._capturedCps = project.connectionPoints.captureDragCps(
      this._components,
      this._wires,
      dragLayer,
      new Set(project.selectionManager.selectedConnectionPoints)
    );

    this._wireSnapshots = this._wires.map((w) => Wire.serialize(w));
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
   * A press while the session floats without a drag anchor (the rotate flow):
   * on the selection it locks in the anchor, off it asks the router to cancel
   * — reverting the rotation. Presses with an anchor already locked are
   * consumed and ignored (paste-placement convention).
   */
  onDown(input: PointerInput): boolean {
    if (this._pointerStart) return true;
    const offset = this.dragLayer.position;
    // Hit-test and anchor in element space: the layer offset translates the
    // whole group, so subtracting it maps the cursor onto the stored element
    // positions (and makes onMove's `gridPos - pointerStart` yield the
    // absolute offset again).
    const local = new Point(input.grid.x - offset.x, input.grid.y - offset.y);
    if (!this.project.selectionManager.isGrabbedAt(local)) return false;
    const gridPos = roundToGrid(input.grid);
    this._pointerStart = new Point(gridPos.x - offset.x, gridPos.y - offset.y);
    return true;
  }

  onMove(input: PointerInput): void {
    if (!this._pointerStart) return;
    const gridPos = roundToGrid(input.grid, true);
    this.dragLayer.position.set(
      gridPos.x - this._pointerStart.x,
      gridPos.y - this._pointerStart.y
    );
    // The selection grab rect rides along with the dragged ghosts.
    this.project.floatingLayer.setSelectionRectOffset(this.dragLayer.position);
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
   * snapped centre, in element space — the drag offset translates the result,
   * so visually the group spins around its own middle wherever it hangs. The
   * carried junction dots and the frozen grab rect turn with it.
   */
  rotate(steps: number): void {
    const s = normalizeRotationSteps(steps);
    if (s === 0) return;
    const bounds = groupGridBounds(this._components, this._wires);
    if (!bounds) return;
    const pivot = rotationPivotFor(bounds);

    // Read the rect before the elements move — grabRect() translates the
    // frozen rect by how far the bounding box has drifted since it was set.
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
      // The freeze redraws the rect at its base position; re-apply the drag
      // offset so it keeps riding with the ghosts.
      this.project.floatingLayer.setSelectionRectOffset(
        this.dragLayer.position
      );
    }
    this._collision.update();
  }

  /**
   * Floating without a drag anchor: opened by the rotate/move flow and not yet
   * grabbed. The router auto-commits such a session once a discrete rotate/move
   * clears the collision. Once grabbed (onDown locks `_pointerStart`) this turns
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
    // Back to base; the actionChange$ redraw below re-places it at the moved
    // bounds (a zero-delta end left it at base the whole time).
    this.project.floatingLayer.setSelectionRectOffset(this.dragLayer.position);
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

    // Run integration over the post-move scene. The integrator may split wires
    // whose interiors are now crossed by a moved port/endpoint, and merge wires
    // at old positions where a port/endpoint no longer blocks.
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

    // A moved (or turned) wire that survived integration records its own
    // geometry change; rotation swaps the axis on odd steps, so those record
    // as rotate entries instead of positional moves.
    const addSurvivedWireActions = (survived: Wire[]): void => {
      if (survived.length === 0) return;
      if (hasRotation) {
        action.add(
          new RotateWiresAction(
            ...survived.map((w) => {
              const snap = this._wireSnapshots.find((s) => s.id === w.id)!;
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
          const snap = this._wireSnapshots.find((s) => s.id === w.id)!;
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

      // Moved wires that the integrator changed: serialize at OLD geometry so
      // the corresponding undo path restores them where they came from.
      const movedAndChangedSnapshots = this._wireSnapshots.filter((s) =>
        removedIds.has(s.id)
      );
      // External wires absorbed by merges or split by an arriving port — capture
      // at their current positions (the project tree still has them).
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

    // Captured before the removals below: the moved wires' final geometry
    // (the removals destroy the instances the integrator replaced — the basis
    // for deciding which replacement wires the selection adopts) and the
    // frozen grab rect (the removals evict the replaced originals, which can
    // empty or shrink the bounding box the rect's translation anchors to —
    // read afterwards it would come back displaced or null).
    const movedFinalSnapshots = this._wires.map((w) => Wire.snapshot(w));
    const grabRectBeforeIntegration = this.project.selectionManager.grabRect();

    // Materialize the integrator's changes with the live instances (positions
    // were already applied in the move loop above), then register — the
    // recorded action never re-runs against this state.
    for (const w of toRemove) this.project.removeWire(w.id);
    for (const w of toAdd) this.project.addWire(w);

    if (toRemove.length > 0 || toAdd.length > 0) {
      // Keep the selection covering what the user moved: a replacement wire
      // that shares a span with a moved wire is its merge/split successor and
      // joins the selection (the evicted original is gone); an external
      // wire's split pieces only ever touch the selection at an endpoint and
      // stay out. Then re-freeze the rect captured above over the re-derived
      // membership.
      this.project.selectionManager.adoptWires(
        toAdd.filter((w) => {
          const snap = Wire.snapshot(w);
          return movedFinalSnapshots.some((s) => snapshotsShareSpan(s, snap));
        })
      );
      this.project.selectionManager.freezeGrabRect(grabRectBeforeIntegration);
    }

    getStaticDI(LoggingService).debug(
      `committed move: ${this._components.length} component(s) and ${this._wires.length} wire(s) moved (${this._netSteps} quarter-turn(s)); ` +
        `integration added ${toAdd.length} and removed ${toRemove.length} wire(s)`,
      'SelectionMoveSession'
    );

    if (action.length > 0) {
      // A drag that started from a SELECT_EXACT scissor selection commits the
      // cut: coalescing folds the cut's history entry and this move into one
      // undo step. On a zero-change end we returned above without consuming,
      // leaving the cut live for the next selection-clear to retract.
      const cut = this.project.selectionManager.consumeLiveCut();
      if (cut) {
        this.project.actionManager.coalesceTop(cut, action);
      } else {
        this.project.actionManager.register(action);
      }
    }

    // Re-derive the highlighted junctions only after the commit: the wire
    // removals above cycle terminations at the affected junctions, destroying
    // and recreating the dot at any exactly-3-termination point, so a CP
    // selected earlier would be a dead instance by now — leaving the dots
    // unhighlighted and dropping them from the next drag's capture set.
    this.project.selectionManager.retintCps();
  }

  onCancel(): void {
    getStaticDI(LoggingService).debug(
      `cancelled move: ${this._components.length} component(s) and ${this._wires.length} wire(s) reattached at their original positions`,
      'SelectionMoveSession'
    );
    if (this._netSteps !== 0) {
      // Undo the in-place rotation before reattaching, so termination counts
      // and the frozen rect land back on the original geometry.
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
    this.project.reattachFromDrag(this._components, this._wires);
    this.project.connectionPoints.restoreDragCps(this._capturedCps);
  }
}
