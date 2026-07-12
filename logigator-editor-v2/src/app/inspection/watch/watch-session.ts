import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { SwitchComponent } from '../../components/component-types/switch/switch.component';
import { LoggingService } from '../../logging/logging.service';
import { LinkRenderTargets } from '../../simulation/compiler/compiled-board.model';
import { WatchLevelInfo } from '../../simulation/compiler/watch-index';
import {
  LinkStateApplier,
  SnapshotApplier
} from '../../simulation/state/link-state-applier';
import { SimulationService } from '../../simulation/simulation.service';
import {
  buildProject,
  instantiateBody
} from '../../persistence/circuit-builder';
import { SerializedCircuitBody } from '../../persistence/serialized-circuit';
import { Project } from '../../project/project';
import { getStaticDI } from '../../utils/get-di';
import { TranslocoService } from '@jsverse/transloco';
import { Wire } from '../../wires/wire';

/**
 * One live view of one inner circuit (one breadcrumb level of a watch): a
 * fresh headless {@link Project} instantiated from the level's circuit body,
 * wired to the running engine through a sparse {@link LinkStateApplier} whose
 * targets resolve through the compiler's watch index. Registered with the
 * simulation's snapshot fan-out on construction and seeded by a full
 * snapshot; `destroy()` unregisters and destroys the copies.
 *
 * The index tables are keyed by body-array position, so the arrays produced
 * by `instantiateBody` here line up with the ones the compiler recorded
 * against (the order contract pinned in `circuit-builder.spec.ts`). A shape
 * mismatch means the definition changed under the session — construction
 * fails loudly instead of mis-lighting wires.
 */
export class WatchSession {
  public readonly project: Project;
  public readonly components: Component[];
  public readonly wires: Wire[];

  private readonly applier: LinkStateApplier;
  private readonly unregister: () => void;
  private needsSwitchSync = false;

  constructor(
    body: SerializedCircuitBody,
    public readonly info: WatchLevelInfo,
    links: number
  ) {
    const provider = getStaticDI(ComponentProviderService);
    const simulation = getStaticDI(SimulationService);

    const { components, wires } = instantiateBody(provider, body);
    const { wireNets, portNets } = info.tables;
    if (
      wireNets.length !== wires.length ||
      portNets.length !== components.length
    ) {
      getStaticDI(LoggingService).debug(
        `watch shape mismatch: wireNets ${wireNets.length} vs wires ` +
          `${wires.length}, portNets ${portNets.length} vs components ` +
          `${components.length}`,
        'WatchSession'
      );
      for (const component of components) component.destroy({ children: true });
      for (const wire of wires) wire.destroy();
      throw new Error(
        getStaticDI(TranslocoService).translate('watch.circuitMismatch')
      );
    }
    this.components = components;
    this.wires = wires;
    this.project = buildProject(components, wires);

    // Sparse render targets over the full link-id space: only this circuit's
    // links carry targets. `-1` local nets (wire-only, never powered) and
    // `-1` links are skipped.
    const targets: LinkRenderTargets[] = Array.from({ length: links }, () => ({
      wires: [],
      ports: []
    }));
    const linkOf = (localNet: number): number =>
      localNet >= 0 ? info.linkOfLocalNet[localNet] : -1;
    wires.forEach((wire, index) => {
      const link = linkOf(wireNets[index]);
      if (link >= 0) targets[link].wires.push(wire);
    });
    components.forEach((component, index) => {
      portNets[index].forEach((localNet, portIndex) => {
        const link = linkOf(localNet);
        if (link >= 0) targets[link].ports.push({ component, portIndex });
      });
    });

    this.applier = new LinkStateApplier(targets);
    // Wrap the applier so the first *full* snapshot triggers the one-time
    // switch pose sync — deltas arriving before the seed don't count.
    const sessionApplier: SnapshotApplier = {
      applyDelta: (ids, values) => this.applier.applyDelta(ids, values),
      applyFull: (bits) => {
        this.applier.applyFull(bits);
        this.needsSwitchSync = true;
      }
    };
    this.unregister = simulation.registerApplier(sessionApplier);
    simulation.requestSnapshot();
  }

  /**
   * Per-frame pull (after each applied snapshot): returns whether the view
   * needs a re-render. The first full snapshot additionally poses the copied
   * switches from their output-port power — a switch drives its output link
   * directly, so the link state *is* the switch state.
   */
  public onFrame(): boolean {
    const changed = this.applier.consumeChanged();
    if (this.needsSwitchSync) {
      this.needsSwitchSync = false;
      this._syncSwitches();
      return true;
    }
    return changed;
  }

  public destroy(): void {
    this.unregister();
    this.project.destroy({ children: true });
  }

  private _syncSwitches(): void {
    this.components.forEach((component, index) => {
      if (!(component instanceof SwitchComponent)) {
        return;
      }
      const outputNet = this.info.tables.portNets[index][component.numInputs];
      const link = outputNet >= 0 ? this.info.linkOfLocalNet[outputNet] : -1;
      if (link >= 0) {
        component.setOn(this.applier.isPowered(link));
      }
    });
  }
}
