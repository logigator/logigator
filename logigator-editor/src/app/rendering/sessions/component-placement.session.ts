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
import { WorkModeService } from '../../work-mode/work-mode.service';

export class ComponentPlacementSession implements DragSession {
  // A drop onto a colliding area clears the ghost rather than freezing it.
  readonly discardOnInvalidRelease = true;

  private readonly _ghost: PlacementGhost;
  // The config the palette armed — the master, for a custom — kept for the
  // sticky placement direction its type id keys.
  private readonly _config: ComponentConfig;
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
    this._config = placeConfig;
    // The ghost is built from the palette config and stays on it for the whole
    // gesture, so what the settings panel writes while placing — options,
    // direction — lands on the very config the commit builds from.
    this._ghost = new PlacementGhost(project, dragLayer, placeConfig, startPos);
  }

  onMove(input: PointerInput): void {
    this._ghost.moveTo(roundToGrid(input.grid, true));
  }

  canEnd(): boolean {
    return !this._ghost.hasCollision;
  }

  /** A rotate request mid-drag turns the ghost where it stands. */
  rotate(steps: number): void {
    const direction = getStaticDI(WorkModeService).rotatePlacementDirection(
      this._config.type,
      steps
    );
    this._ghost.setDirection(direction);
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

    const ghost = this._ghost.component;
    // The instance the commit adds: a built-in is the ghost itself, a custom is
    // re-frozen onto a placement snapshot.
    const placed = ComponentPlacementSession._freeze(ghost);

    // Splits any wire whose interior passes under one of the placed component's ports.
    const { toAdd, toRemove } = this.project.topology.integrate({
      addedComponentPorts: placed.connectionPoints
    });

    // The actions snapshot in their constructors, so build them before the
    // mutations, then materialize the final state directly and register.
    const action = new ActionContainer();
    if (toRemove.length > 0) {
      action.add(new RemoveWiresAction(toRemove));
    }
    action.add(new AddComponentsAction([placed]));
    if (toAdd.length > 0) {
      action.add(new AddWiresAction(toAdd));
    }

    // The ghost lands itself, minus its preview look; a frozen replacement is
    // a separate instance, so the preview goes away instead.
    if (placed === ghost) this._ghost.release();
    else this._ghost.destroy();

    for (const w of toRemove) this.project.removeWire(w.id);
    this.project.addComponent(placed);
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
   * **frozen snapshot** of the master's current state (snapshot-at-place-time):
   * placing the same master after editing it yields a fresh snapshot with the
   * new shape, and the placed instance never follows later master edits.
   *
   * The ghost was built from the palette config, so freezing round-trips it
   * through the serializer: position, direction, options and negations carry
   * onto a fresh snapshot-config instance, and a setting added later is carried
   * with no code here — every option already round-trips for save and undo.
   * Built-ins (and snapshot configs) place as-is.
   */
  private static _freeze(component: Component): Component {
    const registry = getStaticDI(CustomComponentRegistry);
    const def = registry.getDefinition(component.config.type);
    if (def?.kind !== 'master') return component;
    const config = getStaticDI(ComponentProviderService).getComponent(
      registry.snapshot(def.typeId).typeId
    );
    return config
      ? Component.deserialize(Component.serialize(component), config)
      : component;
  }
}
