import { Container, FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { ActionContainer } from '../../actions/action-container';
import { MoveComponentsAction } from '../../actions/actions/move-components.action';
import { MoveWiresAction } from '../../actions/actions/move-wires.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { MoveEntry } from '../../actions/actions/move-entry.model';
import { SerializedWire } from '../../wires/serialized-wire.model';
import { WireSnapshot } from '../../wires/wire-snapshot.model';
import { DragCollisionState } from './drag-collision';

export class SelectionMoveSession implements DragSession {
  private readonly _components: Component[];
  private readonly _wires: Wire[];
  private readonly _pointerStart: Point;
  private readonly _collision: DragCollisionState;
  private _capturedCps: ConnectionPoint[] = [];

  constructor(
    private readonly project: Project,
    private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
    components: ReadonlySet<Component>,
    wires: ReadonlySet<Wire>,
    pointerStart: Point
  ) {
    this._components = [...components];
    this._wires = [...wires];
    this._pointerStart = pointerStart;

    project.detachForDrag(this._components, this._wires);
    for (const c of this._components) dragLayer.addChild(c);
    for (const w of this._wires) dragLayer.addChild(w);
    // dragLayer starts at (0,0) offset; selection was non-overlapping before
    // detach, so no initial collision check is needed.
    this._collision = new DragCollisionState(
      project,
      dragLayer,
      this._components,
      this._wires
    );
    this._capturedCps = project.connectionPoints.captureDragCps(
      this._components,
      this._wires,
      dragLayer
    );
  }

  onMove(e: FederatedPointerEvent): void {
    const gridPos = roundToGrid(
      e.getLocalPosition(this.project.gridSpace),
      true
    );
    this.dragLayer.position.set(
      gridPos.x - this._pointerStart.x,
      gridPos.y - this._pointerStart.y
    );
    this._collision.update();
  }

  canEnd(): boolean {
    return !this._collision.hasCollision;
  }

  onEnd(): void {
    const delta = this.dragLayer.position.clone();
    const hasMove = delta.x !== 0 || delta.y !== 0;

    // All captures here happen BEFORE the delta is applied — wires and components
    // are still at their pre-drag positions.
    const wireSnapshots: SerializedWire[] = this._wires.map((w) =>
      Wire.serialize(w)
    );
    const oldWireSnapshotsList: WireSnapshot[] = this._wires.map((w) =>
      Wire.snapshot(w)
    );
    const oldWireSnapshotsById = new Map<number, WireSnapshot>(
      this._wires.map((w, i) => [w.id, oldWireSnapshotsList[i]])
    );
    const componentOldPorts = new Map<number, readonly Point[]>(
      this._components.map((c) => [c.id, c.connectionPoints])
    );
    const componentOldPos = new Map(
      this._components.map((c) => [c.id, c.position.clone()])
    );

    for (const child of this.dragLayer.children) {
      if (child instanceof ConnectionPoint) continue;
      child.position.set(
        child.position.x + delta.x,
        child.position.y + delta.y
      );
    }

    this.dragLayer.position.set(0, 0);
    this.dragLayer.tint = 0xffffff;
    this.project.reattachFromDrag(this._components, this._wires);

    if (!hasMove) {
      this.project.connectionPoints.restoreDragCps(this._capturedCps);
      return;
    }

    this.project.connectionPoints.discardDragCps(this._capturedCps);

    // Run integration over the post-move scene. The integrator may split wires
    // whose interiors are now crossed by a moved port/endpoint, and merge wires
    // at old positions where a port/endpoint no longer blocks.
    const { toAdd, toRemove } = this.project.computeIntegration({
      movedWires: this._wires.map((w) => ({
        wire: w,
        oldSnapshot: oldWireSnapshotsById.get(w.id)!
      })),
      movedComponentPorts: this._components.map((c) => ({
        oldPorts: componentOldPorts.get(c.id)!,
        newPorts: c.connectionPoints
      }))
    });

    this.project.connectionPoints.recomputeCpsForMovedSelection(
      componentOldPorts,
      oldWireSnapshotsList,
      this._components,
      this._wires
    );
    this.project.selectionManager.retintCps();

    const action = new ActionContainer();

    // If this drag started from a SELECT_EXACT selection with a tentative
    // scissor cut, fold that cut into the action so cut+move undo as one step.
    // On hasMove === false we returned above without claiming, leaving the
    // pending cut for the next selection-clear to roll back.
    const pendingCut = this.project.selectionManager.claimPendingCut();
    if (pendingCut) {
      action.add(pendingCut);
    }

    if (this._components.length > 0) {
      const componentEntries: MoveEntry[] = this._components.map((c) => ({
        id: c.id,
        oldPos: componentOldPos.get(c.id)!,
        newPos: c.position.clone()
      }));
      action.add(new MoveComponentsAction(...componentEntries));
    }

    if (toRemove.length > 0) {
      const removedIds = new Set(toRemove.map((w) => w.id));
      const movedIds = new Set(this._wires.map((w) => w.id));

      // Moved wires that survived integration — record positional moves.
      const survived = this._wires.filter((w) => !removedIds.has(w.id));
      if (survived.length > 0) {
        const entries: MoveEntry[] = survived.map((w) => {
          const snap = wireSnapshots.find((s) => s.id === w.id)!;
          return {
            id: w.id,
            oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
            newPos: w.position.clone()
          };
        });
        action.add(new MoveWiresAction(...entries));
      }

      // Moved wires that the integrator changed: serialize at OLD positions so
      // the corresponding undo path restores them where they came from.
      const movedAndChangedSnapshots = wireSnapshots.filter((s) =>
        removedIds.has(s.id)
      );
      // External wires absorbed by merges or split by an arriving port — capture
      // at their current positions (the project tree still has them).
      const externalAbsorbed = toRemove.filter((w) => !movedIds.has(w.id));
      const externalAbsorbedSnapshots = externalAbsorbed.map((w) =>
        Wire.serialize(w)
      );

      const mergeRemove = new RemoveWiresAction(
        ...movedAndChangedSnapshots,
        ...externalAbsorbedSnapshots
      );
      const mergeAdd = new AddWiresAction(...toAdd);
      action.add(mergeRemove);
      action.add(mergeAdd);

      if (pendingCut) {
        // register() below records the action without re-running its do(); apply
        // the integrator's mutations directly so the project ends up in the same
        // state push() would have produced.
        mergeRemove.do(this.project);
        mergeAdd.do(this.project);
      }
    } else if (this._wires.length > 0) {
      // No integrator changes — straight move.
      const wireEntries: MoveEntry[] = wireSnapshots.map((snap, i) => ({
        id: snap.id,
        oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
        newPos: this._wires[i].position.clone()
      }));
      action.add(new MoveWiresAction(...wireEntries));
    }

    if (action.length > 0) {
      if (pendingCut) {
        // Cut + move state is already fully materialized in the project
        // (cut at scissor time, positions in the move loop above, merges
        // just now). register() records the action without re-running its
        // do() — which would otherwise re-deserialize cut pieces with
        // IDs already in the quad tree.
        this.project.actionManager.register(action);
      } else {
        this.project.actionManager.push(action);
      }
    }
  }

  onCancel(): void {
    this.dragLayer.position.set(0, 0);
    this.dragLayer.tint = 0xffffff;
    this.project.reattachFromDrag(this._components, this._wires);
    this.project.connectionPoints.restoreDragCps(this._capturedCps);
  }
}
