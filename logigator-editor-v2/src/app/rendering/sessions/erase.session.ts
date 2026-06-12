import { FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { SerializedComponent } from '../../components/serialized-component.model';
import { Wire } from '../../wires/wire';
import { SerializedWire } from '../../wires/serialized-wire.model';
import { ActionContainer } from '../../actions/action-container';
import { RemoveComponentsAction } from '../../actions/actions/remove-components.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';

export class EraseSession implements DragSession {
  private readonly _deletedComponentIds = new Set<number>();
  private readonly _deletedComponents: SerializedComponent[] = [];
  private readonly _deletedWireIds = new Set<number>();
  private readonly _deletedWires: SerializedWire[] = [];
  private _prevPos: Point;

  private readonly componentProviderService = getStaticDI(
    ComponentProviderService
  );

  constructor(
    private readonly project: Project,
    startPos: Point
  ) {
    this._prevPos = startPos.clone();
    this._eraseSweep(startPos, startPos);
  }

  onMove(e: FederatedPointerEvent): void {
    const local = e.getLocalPosition(this.project.gridSpace);
    this._eraseSweep(this._prevPos, local);
    this._prevPos = local.clone();
  }

  onEnd(): void {
    if (
      this._deletedComponents.length === 0 &&
      this._deletedWires.length === 0
    ) {
      return;
    }
    const action = new ActionContainer();
    if (this._deletedComponents.length > 0) {
      action.add(new RemoveComponentsAction(...this._deletedComponents));
    }
    if (this._deletedWires.length > 0) {
      action.add(new RemoveWiresAction(...this._deletedWires));
    }
    this.project.actionManager.register(action);
  }

  onCancel(): void {
    for (const wire of this._deletedWires) {
      this.project.addWire(Wire.deserialize(wire));
    }
    for (const comp of this._deletedComponents) {
      const config = this.componentProviderService.getComponent(comp.type);
      if (!config) continue;
      this.project.addComponent(Component.deserialize(comp, config));
    }
  }

  canEnd(): boolean {
    return true;
  }

  private _eraseSweep(from: Point, to: Point): void {
    const minX = Math.min(Math.floor(from.x), Math.floor(to.x));
    const minY = Math.min(Math.floor(from.y), Math.floor(to.y));
    const maxX = Math.max(Math.floor(from.x), Math.floor(to.x)) + 1;
    const maxY = Math.max(Math.floor(from.y), Math.floor(to.y)) + 1;
    const sweepRect = new Rectangle(minX, minY, maxX - minX, maxY - minY);

    for (const comp of [...this.project.queryComponentsInRange(sweepRect)]) {
      if (this._deletedComponentIds.has(comp.id)) continue;
      this._deletedComponentIds.add(comp.id);
      this._deletedComponents.push(Component.serialize(comp));
      this.project.removeComponent(comp.id);
    }

    for (const wire of [...this.project.queryWiresInRange(sweepRect)]) {
      if (this._deletedWireIds.has(wire.id)) continue;
      this._deletedWireIds.add(wire.id);
      this._deletedWires.push(Wire.serialize(wire));
      this.project.removeWire(wire.id);
    }
  }
}
