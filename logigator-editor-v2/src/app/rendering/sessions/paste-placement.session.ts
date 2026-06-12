import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { ActionContainer } from '../../actions/action-container';
import { AddComponentsAction } from '../../actions/actions/add-components.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { DragCollisionState } from './drag-collision';

export class PastePlacementSession implements DragSession {
  private readonly _collision: DragCollisionState;
  private _isDragging = false;
  private _anchor: Point | null = null;

  public get isDragging(): boolean {
    return this._isDragging;
  }

  public beginDrag(anchor: Point): void {
    this._isDragging = true;
    this._anchor = anchor;
  }

  public containsPoint(p: Point): boolean {
    for (const c of this._components) {
      if (this._boundsWorld(c).contains(p.x, p.y)) return true;
    }
    for (const w of this._wires) {
      if (this._wireBoundsWorld(w).contains(p.x, p.y)) return true;
    }
    return false;
  }

  constructor(
    private readonly _project: Project,
    private readonly _dragLayer: Container<Component | Wire | ConnectionPoint>,
    private readonly _components: Component[],
    private readonly _wires: Wire[]
  ) {
    for (const c of _components) {
      c.tint = 0x888888;
      c.applyScale(_project.scale.x);
      _dragLayer.addChild(c);
    }
    for (const w of _wires) {
      w.tint = 0x888888;
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
  }

  onMove(e: FederatedPointerEvent): void {
    if (!this._isDragging) return;
    const cursor = roundToGrid(
      e.getLocalPosition(this._project.gridSpace),
      true
    );
    this._dragLayer.position.set(
      cursor.x - this._anchor!.x,
      cursor.y - this._anchor!.y
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
    this._dragLayer.tint = 0xffffff;

    // Build action before handing elements to the project (serializes final positions)
    const action = new ActionContainer();
    if (this._components.length > 0) {
      action.add(new AddComponentsAction(...this._components));
    }
    if (this._wires.length > 0) {
      action.add(new AddWiresAction(...this._wires));
    }

    // Transfer elements from drag layer to project (addChild inside insert() re-parents)
    for (const c of this._components) this._project.addComponent(c);
    for (const w of this._wires) this._project.addWire(w);

    this._project.selectionManager.select(this._components, this._wires);

    // State already applied — register without calling do()
    this._project.actionManager.register(action);
  }

  onCancel(): void {
    this._dragLayer.position.set(0, 0);
    this._dragLayer.tint = 0xffffff;
    for (const c of this._components) c.destroy({ children: true });
    for (const w of this._wires) w.destroy();
  }

  private _boundsWorld(comp: Component): Rectangle {
    const b = comp.gridBounds;
    return new Rectangle(
      b.x + this._dragLayer.position.x,
      b.y + this._dragLayer.position.y,
      b.width,
      b.height
    );
  }

  private _wireBoundsWorld(wire: Wire): Rectangle {
    const b = wire.gridBounds;
    return new Rectangle(
      b.x + this._dragLayer.position.x,
      b.y + this._dragLayer.position.y,
      b.width,
      b.height
    );
  }
}
