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
  // Defense in depth: the palette already hides masters that would cycle while
  // editing one, but a master may still reach here (stale `componentToPlace`,
  // future paste). Decided up front so onEnd can refuse to commit.
  private readonly _wouldCycle: boolean;

  constructor(
    private readonly project: Project,
    dragLayer: Container<Component | Wire | ConnectionPoint>,
    startPos: Point,
    placeConfig: ComponentConfig
  ) {
    this._wouldCycle = wouldCyclePlacement(project, placeConfig);
    // Skip snapshotting a master that won't be committed; the master config
    // renders the ghost fine on its own.
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

    // Splits any wire whose interior passes under one of the placed component's ports.
    const { toAdd, toRemove } = this.project.topology.integrate({
      addedComponentPorts: this._ghost.component.connectionPoints
    });

    // The actions snapshot in their constructors, so build them before the
    // mutations, then materialize the final state directly and register —
    // the ghost instance itself becomes the placed component.
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
}
