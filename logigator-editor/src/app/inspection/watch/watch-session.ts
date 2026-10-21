import { Point } from 'pixi.js';
import { Component } from '../../components/component';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { ComponentProviderService } from '../../components/component-provider.service';
import { KeyboardComponent } from '../../components/component-types/keyboard/keyboard.component';
import { TerminalComponent } from '../../components/component-types/terminal/terminal.component';
import { isUserInput } from '../../components/user-input';
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
import { SerializedCircuitBody } from '@logigator/core';
import { Project } from '../../project/project';
import { getStaticDI } from '../../utils/get-di';
import { TranslationService } from '../../translation/translation.service';
import { Wire } from '../../wires/wire';

/**
 * One live view of one inner circuit (one breadcrumb level of a watch): a fresh
 * headless {@link Project} instantiated from the level's circuit body, wired to
 * the running engine through a sparse {@link LinkStateApplier} whose targets
 * resolve through the compiler's watch index. Registered with the snapshot
 * fan-out on construction and seeded by a full snapshot.
 *
 * The index tables are keyed by body-array position, so the arrays
 * `instantiateBody` produces here must line up with the ones the compiler
 * recorded against. A shape mismatch means the definition changed under the
 * session — construction fails loudly instead of mis-lighting wires.
 */
export class WatchSession {
  public readonly project: Project;
  public readonly components: Component[];
  public readonly wires: Wire[];

  private readonly applier: LinkStateApplier;
  private readonly unregister: () => void;
  private needsSwitchSync = false;
  private readonly terminals: TerminalComponent[] = [];
  private readonly terminalVersions: number[] = [];
  private seenResets: number;

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
        getStaticDI(TranslationService).translate('watch.circuitMismatch')
      );
    }
    this.components = components;
    this.wires = wires;
    // A watch only ever exists inside a live session, so its copies read a
    // negated input the way the board's own components do.
    for (const component of components) component.setSimulating(true);
    // A terminal copy reads its recorder from the oldest record the engine
    // still holds, so its screen replays what was printed before the level
    // opened.
    components.forEach((component, index) => {
      const unit = info.recordUnitFor(index);
      if (component instanceof TerminalComponent && unit !== undefined) {
        component.readRecords((onRead) =>
          simulation.watchUnitRecords(unit, onRead)
        );
        this.terminals.push(component);
        this.terminalVersions.push(component.screen.version);
      }
    });
    this.seenResets = simulation.resets();
    this.project = buildProject(components, wires);

    // Sparse render targets over the full link-id space: only this circuit's
    // links carry targets. `-1` local nets (wire-only) and `-1` links are
    // skipped.
    const targets: LinkRenderTargets[] = Array.from({ length: links }, () => ({
      wires: [],
      ports: [],
      junctions: []
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
    // The copy's own junction dots, found at its targets' termination points:
    // the index records no dots, and every dot sits on a wire end or a port.
    const dots = this.project.connectionPoints;
    const placed = new Set<ConnectionPoint>();
    const addJunctionAt = (target: LinkRenderTargets, point: Point): void => {
      const dot = dots.getCpAt(point);
      if (dot && !placed.has(dot)) {
        placed.add(dot);
        target.junctions.push(dot);
      }
    };
    for (const target of targets) {
      for (const wire of target.wires) {
        for (const point of wire.connectionPoints) addJunctionAt(target, point);
      }
      for (const { component, portIndex } of target.ports) {
        // An LED matrix's cell pseudo-ports have no point on the board.
        const point = component.connectionPoints[portIndex];
        if (point) addJunctionAt(target, point);
      }
    }

    this.applier = new LinkStateApplier(targets);
    // Only a *full* snapshot triggers the one-time toggle pose sync; deltas
    // arriving before the seed don't count.
    const sessionApplier: SnapshotApplier = {
      applyDelta: (ids, values) => this.applier.applyDelta(ids, values),
      applyFull: (bits) => {
        this.applier.applyFull(bits);
        this.needsSwitchSync = true;
      },
      applyConflicts: (ids) => this.applier.applyConflicts(ids)
    };
    this.unregister = simulation.registerApplier(sessionApplier);
    simulation.requestSnapshot();
  }

  /**
   * Per-frame pull: returns whether the view needs a re-render. The first full
   * snapshot additionally poses the copies' `toggle` slots from their
   * output-port power — a `level` slot drives its output link directly, so
   * the link state *is* the slot's state. A `hold` copy is not posed: its
   * held state is the one operating it.
   */
  public onFrame(): boolean {
    // A stop clears the board's own components; the copies are cleared here,
    // before the rebuilt recorders' reads from record 0 arrive.
    const resets = getStaticDI(SimulationService).resets();
    if (resets !== this.seenResets) {
      this.seenResets = resets;
      for (const terminal of this.terminals) terminal.clearSimState();
    }
    // A screen can change with no link the frame moved.
    let changed = this.applier.consumeChanged();
    this.terminals.forEach((terminal, index) => {
      const version = terminal.screen.version;
      if (version !== this.terminalVersions[index]) {
        this.terminalVersions[index] = version;
        changed = true;
      }
    });
    if (this.needsSwitchSync) {
      this.needsSwitchSync = false;
      this._syncToggles();
      return true;
    }
    return changed;
  }

  public destroy(): void {
    this.unregister();
    for (const terminal of this.terminals) terminal.stopReadingRecords();
    // Every high `level` slot of a copy, and the keys a keyboard copy holds
    // down, are set low first: once the copy is gone, nothing is left to
    // reset its engine input.
    const simulation = getStaticDI(SimulationService);
    this.components.forEach((component, index) => {
      const unitIndex = this.info.unitIndexFor(index);
      if (component instanceof KeyboardComponent && unitIndex !== undefined) {
        component.releaseKeys({
          send: (frames) =>
            simulation.sendUnitFrames(unitIndex, component, frames)
        });
        return;
      }
      if (
        !isUserInput(component) ||
        component.drive !== 'level' ||
        unitIndex === undefined
      ) {
        return;
      }
      simulation.setUnitInputs(
        unitIndex,
        component,
        new Array<boolean>(component.inputSlots).fill(false),
        () => undefined
      );
    });
    this.project.destroy({ children: true });
  }

  /**
   * A powered `toggle` slot is adopted through the simulation service, which
   * tracks it like any other high level slot without telling the engine what
   * it already holds.
   */
  private _syncToggles(): void {
    const simulation = getStaticDI(SimulationService);
    const repaint = () => this.project.triggerTicker('single');
    this.components.forEach((component, index) => {
      const unitIndex = this.info.unitIndexFor(index);
      if (
        !isUserInput(component) ||
        component.gesture !== 'toggle' ||
        unitIndex === undefined
      ) {
        return;
      }
      for (let slot = 0; slot < component.inputSlots; slot++) {
        const outputNet =
          this.info.tables.portNets[index][component.numInputs + slot];
        const link = outputNet >= 0 ? this.info.linkOfLocalNet[outputNet] : -1;
        if (link >= 0 && this.applier.isPowered(link)) {
          simulation.adoptHighLevel(unitIndex, component, repaint, slot);
        }
      }
    });
  }
}
