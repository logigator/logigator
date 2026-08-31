import { Container, Point, Rectangle } from 'pixi.js';
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
import { SnapshotSpanIndex } from '../../wires/wire-snapshot.model';
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
   * The session outlives its opening gesture: the ghosts wait until the user
   * presses again. Inside the group's rect that locks the drag anchor in,
   * outside it asks the router to cancel. Extra presses while dragging are
   * consumed and ignored.
   */
  public onDown(input: PointerInput): boolean {
    if (this._isDragging) return true;
    if (!this.containsPoint(input.grid)) return false;
    const offset = this._dragLayer.position;
    const gridPos = roundToGrid(input.grid, true);
    // Anchor in element space: onMove derives the layer offset from it, so a
    // re-grab of ghosts already carrying an offset must not fold it in.
    this.beginDrag(new Point(gridPos.x - offset.x, gridPos.y - offset.y));
    return true;
  }

  public beginDrag(anchor: Point): void {
    this._isDragging = true;
    this._anchor = anchor;
  }

  /**
   * The drop landed on a collision, so the ghosts stay put. Releasing the
   * anchor puts the session back to waiting for a press, so the next one grabs
   * where it lands rather than pulling the ghosts under the old anchor.
   */
  public onInvalidRelease(): void {
    this._isDragging = false;
    this._anchor = null;
  }

  /**
   * The grab zone is the rect the ghosts wear, not their individual bounds —
   * the same padded content rect a committed selection grabs by, so the gaps
   * between pasted elements drag the group before and after it is put down.
   */
  public containsPoint(p: Point): boolean {
    const rect = this._grabRect();
    if (!rect) return false;
    return offsetRect(rect, this._dragLayer.position).contains(p.x, p.y);
  }

  /** The ghosts' padded content bounds, in element space. */
  private _grabRect(): Rectangle | null {
    const bounds = groupGridBounds(this._components, this._wires);
    return bounds?.pad(SelectionManager.GRAB_MARGIN) ?? null;
  }

  constructor(
    private readonly _project: Project,
    private readonly _dragLayer: Container<Component | Wire | ConnectionPoint>,
    private readonly _components: Component[],
    private readonly _wires: Wire[]
  ) {
    // Ghosts wear the selection look; on commit select() keeps them selected.
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
    // The group wears its selection rect from the moment it appears, so it
    // reads as selected while it floats.
    this._refreshSelectionRect();
  }

  // Shows the selection rect around the ghosts' padded bounds, translated by
  // the drag offset. Only needed when the group's own geometry changes; a
  // plain move just shifts the offset.
  private _refreshSelectionRect(): void {
    const bounds = this._grabRect();
    if (!bounds) return;
    this._project.floatingLayer.showSelectionRect(bounds);
    this._project.floatingLayer.setSelectionRectOffset(
      this._dragLayer.position
    );
  }

  onMove(input: PointerInput): void {
    if (!this._isDragging) return;
    const cursor = roundToGrid(input.grid, true);
    const x = cursor.x - this._anchor!.x;
    const y = cursor.y - this._anchor!.y;
    // Ghosts only ever sit on the grid, so an unchanged offset has nothing to
    // redraw and nothing new to collide with.
    const position = this._dragLayer.position;
    if (position.x === x && position.y === y) return;
    position.set(x, y);
    this._project.floatingLayer.setSelectionRectOffset(position);
    this._collision.update();
  }

  /**
   * Turns the pasted ghosts clockwise around their snapped centre. Nothing
   * else to track: they are fresh instances the commit serializes at their
   * final geometry, and a cancel destroys them.
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

    // Decides which integration results the selection adopts: a merge/split
    // successor shares a span, an external wire's pieces only touch an end.
    const pastedSpans = new SnapshotSpanIndex(
      this._wires.map((w) => Wire.snapshot(w))
    );

    // Restore the wire invariants around the drop: collinear wires merge, a
    // termination on an interior splits the crossed wire, and a pasted port
    // splits the wire under it.
    const { toAdd, toRemove } = this._project.topology.integrate({
      addedWires: this._wires,
      addedComponentPorts: this._components.flatMap((c) => [
        ...c.connectionPoints
      ])
    });

    // Actions serialize state in their constructors, so build before mutating.
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
    // Emptying the layer up front keeps the transfer linear: re-parenting
    // drops each element from its old parent by index scan.
    this._dragLayer.removeChildren();
    for (const c of this._components) this._project.addComponent(c);
    const committed = new Set(toAdd);
    for (const w of toAdd) this._project.addWire(w);
    // A pasted wire absorbed by a merge never enters the project.
    for (const w of this._wires) {
      if (!committed.has(w) && !w.destroyed) w.destroy();
    }

    this._project.selectionManager.select(
      this._components,
      toAdd.filter((w) => pastedSpans.sharesSpan(Wire.snapshot(w)))
    );

    // State already applied, so register without calling do().
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
    // Cancel clears no selection, so nothing else drops the ghosts' rect.
    this._project.floatingLayer.hideSelectionRect();
    // Emptied in one pass; destroying in place drops each ghost by index scan.
    this._dragLayer.removeChildren();
    for (const c of this._components) c.destroy({ children: true });
    for (const w of this._wires) w.destroy();
  }
}
