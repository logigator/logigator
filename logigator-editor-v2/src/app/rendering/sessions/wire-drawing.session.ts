import { Container, FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { WireDirection } from '../../wires/wire-direction.enum';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { ActionContainer } from '../../actions/action-container';

export class WireDrawingSession implements DragSession {
  private _direction: WireDirection | null = null;
  private _h: Wire | null = null;
  private _v: Wire | null = null;
  private _hasBodyCollision = false;

  constructor(
    private readonly project: Project,
    private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
    private readonly startPos: Point
  ) {}

  onMove(e: FederatedPointerEvent): void {
    const local = e.getLocalPosition(this.project.gridSpace);
    const dx = Math.round(local.x - this.startPos.x);
    const dy = Math.round(local.y - this.startPos.y);

    if (this._direction === null) {
      if (dx === 0 && dy === 0) return;
      this._direction =
        dx !== 0 ? WireDirection.HORIZONTAL : WireDirection.VERTICAL;
      this._h = new Wire(WireDirection.HORIZONTAL, 0);
      this._v = new Wire(WireDirection.VERTICAL, 0);
      this._h.applyScale(this.project.scale.x);
      this._v.applyScale(this.project.scale.x);
      this.dragLayer.addChild(this._h);
      this.dragLayer.addChild(this._v);
    }

    const h = this._h!;
    const v = this._v!;

    h.position.x = this.startPos.x + Math.min(0, dx);
    h.position.y = this.startPos.y;
    v.position.x = this.startPos.x;
    v.position.y = this.startPos.y + Math.min(0, dy);
    h.length = Math.abs(dx);
    v.length = Math.abs(dy);

    if (this._direction === WireDirection.HORIZONTAL) {
      v.position.x = this.startPos.x + dx;
    } else {
      h.position.y = this.startPos.y + dy;
    }

    this._updateBodyCollision();
  }

  onEnd(): void {
    const newWires = ([this._h, this._v] as const).filter(
      (w): w is Wire => w !== null && w.length > 0
    );

    if (newWires.length > 0) {
      const { toAdd, toRemove } = this.project.computeIntegration({
        addedWires: newWires
      });
      const action = new ActionContainer();
      if (toRemove.length > 0) {
        action.add(new RemoveWiresAction(...toRemove));
      }
      action.add(new AddWiresAction(...toAdd));
      this.project.actionManager.push(action);
    }

    this._cleanup();
  }

  canEnd(): boolean {
    return !this._hasBodyCollision;
  }

  onCancel(): void {
    this._cleanup();
  }

  private _updateBodyCollision(): void {
    const hCollision =
      this._h !== null &&
      this._h.length > 0 &&
      this.project.hasWireBodyCollision(this._h.gridBounds);
    const vCollision =
      this._v !== null &&
      this._v.length > 0 &&
      this.project.hasWireBodyCollision(this._v.gridBounds);

    if (this._h) this._h.tint = hCollision ? 0xff4444 : 0xffffff;
    if (this._v) this._v.tint = vCollision ? 0xff4444 : 0xffffff;

    this._hasBodyCollision = hCollision || vCollision;
  }

  private _cleanup(): void {
    this._h?.destroy({ children: true });
    this._v?.destroy({ children: true });
    this._h = null;
    this._v = null;
    this._hasBodyCollision = false;
  }
}
