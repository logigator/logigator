import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { AddComponentsAction } from '../../actions/actions/add-components.action';
import { ActionContainer } from '../../actions/action-container';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { ToastService } from '../../logging/toast.service';

export class ComponentPlacementSession implements DragSession {
  private readonly _component: Component;
  private _hasCollision = false;
  // Defense in depth: the palette already hides masters that would cycle while
  // editing one, but a master may still reach here (stale `componentToPlace`,
  // future paste). Decided up front so onEnd can refuse to commit.
  private readonly _wouldCycle: boolean;

  constructor(
    private readonly project: Project,
    private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
    startPos: Point
  ) {
    const placeConfig = project.componentToPlace!;
    this._wouldCycle = ComponentPlacementSession._wouldCyclePlacement(
      project,
      placeConfig
    );
    // Skip snapshotting a master that won't be committed; the master config
    // renders the ghost fine on its own.
    const config = this._wouldCycle
      ? placeConfig
      : ComponentPlacementSession._resolvePlacementConfig(placeConfig);
    const options = Object.fromEntries(
      Object.entries(config.options).map(([key, opt]) => [key, opt.clone()])
    );
    this._component = config.create(options);
    this._component.tint = 0x888888;
    this._component.applyScale(project.scale.x);
    this._component.position.set(0, 0);
    dragLayer.addChild(this._component);
    dragLayer.position.copyFrom(startPos);
    this._updateCollision();
  }

  onMove(e: FederatedPointerEvent): void {
    this.dragLayer.position.copyFrom(
      roundToGrid(e.getLocalPosition(this.project.gridSpace), true)
    );
    this._updateCollision();
  }

  canEnd(): boolean {
    return !this._hasCollision;
  }

  onEnd(): void {
    if (this._wouldCycle) {
      getStaticDI(ToastService).warn(
        'Cannot place this component here — it would create a circular dependency.'
      );
      this._component.destroy({ children: true });
      this.dragLayer.position.set(0, 0);
      return;
    }

    this._component.position.set(
      this.dragLayer.position.x,
      this.dragLayer.position.y
    );
    this.dragLayer.position.set(0, 0);

    // Splits any wire whose interior passes under one of the placed component's ports.
    const { toAdd, toRemove } = this.project.computeIntegration({
      addedComponentPorts: this._component.connectionPoints
    });

    const action = new ActionContainer();
    if (toRemove.length > 0) {
      action.add(new RemoveWiresAction(...toRemove));
    }
    action.add(new AddComponentsAction(this._component));
    if (toAdd.length > 0) {
      action.add(new AddWiresAction(...toAdd));
    }
    this.project.actionManager.push(action);

    this._component.destroy({ children: true });
  }

  onCancel(): void {
    this._component.destroy({ children: true });
    this.dragLayer.position.set(0, 0);
  }

  private _boundsWorld(): Rectangle {
    const b = this._component.gridBounds;
    return new Rectangle(
      this.dragLayer.position.x + b.x,
      this.dragLayer.position.y + b.y,
      b.width,
      b.height
    );
  }

  private _bodyBoundsWorld(): Rectangle {
    const b = this._component.bodyGridBounds;
    return new Rectangle(
      this.dragLayer.position.x + b.x,
      this.dragLayer.position.y + b.y,
      b.width,
      b.height
    );
  }

  private _updateCollision(): void {
    const collision =
      this.project.hasComponentCollision(
        this._boundsWorld(),
        this._bodyBoundsWorld()
      ) ||
      this.project.hasComponentBodyWireCollision(
        this._bodyBoundsWorld(),
        new Set(),
        this._component.ignoresWireCollision
      );
    if (collision === this._hasCollision) return;
    this._hasCollision = collision;
    // Tint this._component directly (not dragLayer) to avoid multiplying
    // with the container's own tint, which would yield the wrong colour.
    this._component.tint = collision ? 0xff4444 : 0x888888;
  }

  /**
   * The palette lists custom **masters**, but a placed instance must wrap a
   * **frozen snapshot** of the master's current state (snapshot-at-place-time).
   * So when the config to place is a master, snapshot it now and place from the
   * snapshot's config; placing the same master after editing it yields a fresh
   * snapshot with the new shape. Built-ins (and snapshot configs) pass through.
   */
  private static _resolvePlacementConfig(
    config: ComponentConfig
  ): ComponentConfig {
    const registry = getStaticDI(CustomComponentRegistry);
    const def = registry.getDefinition(config.type);
    if (def?.kind !== 'master') return config;
    const snapshot = registry.snapshot(def.typeId);
    return (
      getStaticDI(ComponentProviderService).getComponent(snapshot.typeId) ??
      config
    );
  }

  /**
   * Whether committing this placement would close a dependency cycle: only
   * possible when placing a custom **master** into the editor for a custom master
   * it (transitively) feeds. Built-ins, snapshots, and placements into the main
   * project never cycle.
   */
  private static _wouldCyclePlacement(
    project: Project,
    config: ComponentConfig
  ): boolean {
    const registry = getStaticDI(CustomComponentRegistry);
    const placeDef = registry.getDefinition(config.type);
    if (placeDef?.kind !== 'master') return false;

    const meta = getStaticDI(ProjectMetadataStore).getMetadata(project);
    if (meta?.type !== 'comp' || !meta.id) return false;
    const hostMaster = registry.masterTypeIdForId(meta.id);
    if (hostMaster === undefined) return false;

    return registry.wouldCycle(hostMaster, placeDef.typeId);
  }
}
