import { Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { SerializedComponent } from '../../components/serialized-component.model';
import { Wire } from '../../wires/wire';
import { SerializedWire } from '../../wires/serialized-wire.model';
import { ActionContainer } from '../../actions/action-container';
import { RemoveComponentsAction } from '../../actions/actions/remove-components.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';
import { LoggingService } from '../../logging/logging.service';
import { ToastService } from '../../logging/toast.service';
import { TranslationService } from '../../translation/translation.service';

export class EraseSession implements DragSession {
  private readonly _deletedComponentIds = new Set<number>();
  private readonly _deletedComponents: SerializedComponent[] = [];
  private readonly _deletedWireIds = new Set<number>();
  private readonly _deletedWires: SerializedWire[] = [];
  // Termination points of everything erased so far. The sweep removes live,
  // so by onEnd the instances are gone — these points feed the integrator's
  // vacatedPoints input to merge collinear pairs that lost their junction.
  private readonly _vacatedPoints: Point[] = [];
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

  onMove(input: PointerInput): void {
    const local = input.grid;
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

    // The sweep's removals may have left a collinear pair touching at a point
    // that lost its third terminator (I3). The erased instances are already
    // gone, so their termination points seed the merge as vacated candidates.
    const { toAdd, toRemove } = this.project.topology.integrate({
      vacatedPoints: this._vacatedPoints
    });

    const action = new ActionContainer();
    if (this._deletedComponents.length > 0) {
      action.add(new RemoveComponentsAction(...this._deletedComponents));
    }
    if (this._deletedWires.length > 0) {
      action.add(new RemoveWiresAction(...this._deletedWires));
    }
    if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
    if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));

    for (const w of toRemove) this.project.removeWire(w.id);
    for (const w of toAdd) this.project.addWire(w);
    if (toAdd.length > 0 || toRemove.length > 0) {
      getStaticDI(LoggingService).debug(
        `erase integration added ${toAdd.length} and removed ${toRemove.length} wire(s)`,
        'EraseSession'
      );
    }

    this.project.actionManager.register(action);
  }

  onCancel(): void {
    for (const wire of this._deletedWires) {
      this.project.addWire(Wire.deserialize(wire));
    }
    let dropped = 0;
    for (const comp of this._deletedComponents) {
      const config = this.componentProviderService.getComponent(comp.type);
      if (!config) {
        getStaticDI(LoggingService).warn(
          `Erased component of unresolved type "${comp.type}" cannot be restored; it is dropped`,
          'EraseSession'
        );
        dropped++;
        continue;
      }
      this.project.addComponent(Component.deserialize(comp, config));
    }
    if (dropped > 0) {
      getStaticDI(ToastService).warn(
        getStaticDI(TranslationService).translate('editor.eraseRestoreFailed'),
        'EraseSession'
      );
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

    for (const comp of this.project.queryComponentsInRange(sweepRect)) {
      if (this._deletedComponentIds.has(comp.id)) continue;
      this._deletedComponentIds.add(comp.id);
      this._deletedComponents.push(Component.serialize(comp));
      this._vacatedPoints.push(...comp.connectionPoints.map((p) => p.clone()));
      this.project.removeComponent(comp.id);
    }

    for (const wire of this.project.queryWiresInRange(sweepRect)) {
      if (this._deletedWireIds.has(wire.id)) continue;
      this._deletedWireIds.add(wire.id);
      this._deletedWires.push(Wire.serialize(wire));
      this._vacatedPoints.push(...wire.connectionPoints);
      this.project.removeWire(wire.id);
    }
  }
}
