import { Container, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { PlacementGhost } from '../placement-ghost';
import { roundToGrid } from '../../utils/grid';
import { AddComponentsAction } from '../../actions/actions/add-components.action';
import { ActionContainer } from '../../actions/action-container';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { wouldCyclePlacement } from '../../components/custom/placement-cycle';
import { ComponentProviderService } from '../../components/component-provider.service';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { TranslationService } from '../../translation/translation.service';

export class ComponentPlacementSession implements DragSession {
  // A drop onto a colliding area clears the ghost rather than freezing it.
  readonly discardOnInvalidRelease = true;

  private readonly _ghost: PlacementGhost;
  // The palette hides masters that would cycle, but a stale
  // `componentToPlace` can still reach here. Decided up front so onEnd can
  // refuse to commit.
  private readonly _wouldCycle: boolean;

  constructor(
    private readonly project: Project,
    dragLayer: Container<Component | Wire | ConnectionPoint>,
    startPos: Point,
    placeConfig: ComponentConfig
  ) {
    this._wouldCycle = wouldCyclePlacement(project, placeConfig);
    // No point snapshotting a master that will not be committed.
    const config = this._wouldCycle
      ? placeConfig
      : ComponentPlacementSession._resolvePlacementConfig(placeConfig);
    this._ghost = new PlacementGhost(project, dragLayer, config, startPos);
  }

  onMove(input: PointerInput): void {
    this._ghost.moveTo(roundToGrid(input.grid, true));
  }

  canEnd(): boolean {
    return !this._ghost.hasCollision;
  }

  onEnd(): void {
    if (this._wouldCycle) {
      getStaticDI(ToastService).warn(
        getStaticDI(TranslationService).translate('editor.circularDependency'),
        'ComponentPlacementSession'
      );
      this._ghost.destroy();
      return;
    }

    // Splits any wire whose interior passes under one of the ports.
    const { toAdd, toRemove } = this.project.topology.integrate({
      addedComponentPorts: this._ghost.component.connectionPoints
    });

    // Actions snapshot in their constructors, so build before mutating, then
    // materialize and register. The ghost itself becomes the placed component.
    const action = new ActionContainer();
    if (toRemove.length > 0) {
      action.add(new RemoveWiresAction(...toRemove));
    }
    action.add(new AddComponentsAction(this._ghost.component));
    if (toAdd.length > 0) {
      action.add(new AddWiresAction(...toAdd));
    }

    for (const w of toRemove) this.project.removeWire(w.id);
    this.project.addComponent(this._ghost.release());
    for (const w of toAdd) this.project.addWire(w);

    this.project.actionManager.register(action);
    getStaticDI(LoggingService).debug(
      `committed placement: 1 component added, ${toAdd.length} wire(s) added, ${toRemove.length} wire(s) removed`,
      'ComponentPlacementSession'
    );
  }

  onCancel(): void {
    getStaticDI(LoggingService).debug(
      'cancelled placement: nothing committed',
      'ComponentPlacementSession'
    );
    this._ghost.destroy();
  }

  /**
   * The palette lists custom masters, but a placed instance must wrap a frozen
   * snapshot of the master's state at place time, so a master is snapshotted
   * here and placed from the snapshot's config. Everything else passes through.
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
}
