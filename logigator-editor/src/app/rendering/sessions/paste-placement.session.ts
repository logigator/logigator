import { Container, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { offsetRect, roundToGrid } from '../../utils/grid';
import { rotationPivotFor } from '../../utils/rotation';
import { groupGridBounds, rotateElements } from './rotate-elements';
import { ActionContainer } from '../../actions/action-container';
import { AddComponentsAction } from '../../actions/actions/add-components.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { snapshotsShareSpan } from '../../wires/wire-snapshot.model';
import { DragCollisionState } from './drag-collision';
import { SelectionManager } from '../../project/selection-manager';
import { getStaticDI } from '../../utils/get-di';
import { LoggingService } from '../../logging/logging.service';

export class PastePlacementSession implements DragSession {
  private readonly _collision: DragCollisionState;
  private _isDragging = false;
  private _anchor: Point | null = null;

  public get isDragging(): boolean {
    return this._isDragging;
  }

  /**
   * The paste session outlives its opening gesture: the ghosts wait in place
   * until the user presses again. A press on a ghost locks in the drag anchor;
   * a press off the ghost group asks the router to cancel (discarding the
   * paste). Extra presses while already dragging are consumed and ignored.
   */
  public onDown(input: PointerInput): boolean {
    if (this._isDragging) return true;
    if (!this.containsPoint(input.grid)) return false;
    this.beginDrag(roundToGrid(input.grid, true));
    return true;
  }

  public beginDrag(anchor: Point): void {
    this._isDragging = true;
    this._anchor = anchor;
  }

  public containsPoint(p: Point): boolean {
    const offset = this._dragLayer.position;
    for (const c of this._components) {
      if (offsetRect(c.gridBounds, offset).contains(p.x, p.y)) return true;
    }
    for (const w of this._wires) {
      if (offsetRect(w.gridBounds, offset).contains(p.x, p.y)) return true;
    }
    return false;
  }

  constructor(
    private readonly _project: Project,
    private readonly _dragLayer: Container<Component | Wire | ConnectionPoint>,
    private readonly _components: Component[],
    private readonly _wires: Wire[]
  ) {
    // Ghosts wear the selection look — on commit, select() keeps them
    // selected, so the appearance carries over seamlessly.
    for (const c of _components) {
      c.selected = true;
      c.applyScale(_project.scale.x);
      _dragLayer.addChild(c);
    }
    for (const w of _wires) {
      w.selected = true;
      w.applyScale(_project.scale.x);
      _dragLayer.addChild(w);
    }
    this._collision = new DragCollisionState(
      _project,
      _dragLayer,
      _components,
      _wires
    );
    this._collision.update();
    // The pasted group wears its selection rect from the moment it appears —
    // the same padded rect a committed paste keeps — so it reads as selected
    // while it floats, not only once it is put down.
    this._refreshSelectionRect();
  }

  // Shows the selection rect around the ghosts' padded bounds, translated by
  // the current drag offset so it rides along with them. Called on any change
  // to the group's own geometry (construction, rotation); a plain move only
  // shifts the offset.
  private _refreshSelectionRect(): void {
    const bounds = groupGridBounds(this._components, this._wires);
    if (!bounds) return;
    bounds.pad(SelectionManager.GRAB_MARGIN);
    this._project.floatingLayer.showSelectionRect(bounds);
    this._project.floatingLayer.setSelectionRectOffset(
      this._dragLayer.position
    );
  }

  onMove(input: PointerInput): void {
    if (!this._isDragging) return;
    const cursor = roundToGrid(input.grid, true);
    this._dragLayer.position.set(
      cursor.x - this._anchor!.x,
      cursor.y - this._anchor!.y
    );
    this._project.floatingLayer.setSelectionRectOffset(
      this._dragLayer.position
    );
    this._collision.update();
  }

  /**
   * Turns the pasted ghosts clockwise around their snapped centre. Nothing
   * else to track: the ghosts are fresh instances the commit serializes at
   * their final geometry, and a cancel destroys them outright.
   */
  rotate(steps: number): void {
    const bounds = groupGridBounds(this._components, this._wires);
    if (!bounds) return;
    rotateElements(
      this._components,
      this._wires,
      rotationPivotFor(bounds),
      steps
    );
    // The group's bounds turned with it — re-fit the rect to them.
    this._refreshSelectionRect();
    this._collision.update();
  }

  /**
   * Shifts the ghosts by (dx, dy) grid units. With a drag anchor locked, the
   * anchor shifts opposite so the next pointer move preserves the offset
   * instead of snapping the ghosts back under the cursor.
   */
  moveBy(dx: number, dy: number): void {
    this._dragLayer.position.set(
      this._dragLayer.position.x + dx,
      this._dragLayer.position.y + dy
    );
    this._anchor?.set(this._anchor.x - dx, this._anchor.y - dy);
    this._project.floatingLayer.setSelectionRectOffset(
      this._dragLayer.position
    );
    this._collision.update();
  }

  canEnd(): boolean {
    return !this._collision.hasCollision;
  }

  onEnd(): void {
    const delta = this._dragLayer.position.clone();

    for (const c of this._components) {
      c.position.set(c.position.x + delta.x, c.position.y + delta.y);
    }
    for (const w of this._wires) {
      w.position.set(w.position.x + delta.x, w.position.y + delta.y);
    }
    this._dragLayer.position.set(0, 0);
    this._collision.reset();

    // The pasted wires' final geometry decides which integration results the
    // selection adopts below: a merge/split successor shares a span with a
    // pasted wire, an external wire's split pieces only touch at an endpoint.
    const pastedSnapshots = this._wires.map((w) => Wire.snapshot(w));

    // Restore the wire invariants around the drop: a pasted wire dropped onto
    // a collinear wire merges with it (and pasted split pieces merge with each
    // other), a termination landing on an interior splits the crossed wire —
    // on either side — and a pasted port splits the wire under it.
    const { toAdd, toRemove } = this._project.topology.integrate({
      addedWires: this._wires,
      addedComponentPorts: this._components.flatMap((c) => [
        ...c.connectionPoints
      ])
    });

    // Build actions before mutating (they serialize state in their constructors)
    const action = new ActionContainer();
    if (toRemove.length > 0) {
      action.add(new RemoveWiresAction(...toRemove));
    }
    if (this._components.length > 0) {
      action.add(new AddComponentsAction(...this._components));
    }
    if (toAdd.length > 0) {
      action.add(new AddWiresAction(...toAdd));
    }

    for (const w of toRemove) this._project.removeWire(w.id);
    // Transfer elements from drag layer to project (addChild inside insert() re-parents)
    for (const c of this._components) this._project.addComponent(c);
    const committed = new Set(toAdd);
    for (const w of toAdd) this._project.addWire(w);
    // A pasted wire consumed by integration (absorbed into a merge result)
    // never enters the project — drop the ghost instance.
    for (const w of this._wires) {
      if (!committed.has(w) && !w.destroyed) w.destroy();
    }

    this._project.selectionManager.select(
      this._components,
      toAdd.filter((w) => {
        const snap = Wire.snapshot(w);
        return pastedSnapshots.some((s) => snapshotsShareSpan(s, snap));
      })
    );

    // State already applied — register without calling do()
    this._project.actionManager.register(action);
    getStaticDI(LoggingService).debug(
      `committed paste: ${this._components.length} component(s) added, ${this._wires.length} wire(s) pasted; ` +
        `integration added ${toAdd.length} and removed ${toRemove.length} wire(s)`,
      'PastePlacementSession'
    );
  }

  onCancel(): void {
    getStaticDI(LoggingService).debug(
      `cancelled paste: ${this._components.length} component(s) and ${this._wires.length} wire(s) discarded`,
      'PastePlacementSession'
    );
    this._dragLayer.position.set(0, 0);
    this._collision.reset();
    // The cancel path clears no selection, so nothing else drops the rect we
    // showed for the discarded ghosts — hide it explicitly.
    this._project.floatingLayer.hideSelectionRect();
    for (const c of this._components) c.destroy({ children: true });
    for (const w of this._wires) w.destroy();
  }
}
