import { computed, signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Component } from '../component';
import {
  ComponentInspection,
  InspectionTitlePart
} from '../component-inspection';
import { InspectionService } from '../../inspection/inspection.service';
import { WatchSession } from '../../inspection/watch/watch-session';
import { SubCircuitWatchComponent } from '../../inspection/watch/sub-circuit-watch.component';
import { SerializedCircuitBody } from '../../persistence/serialized-circuit';
import { CompiledBoard } from '../../simulation/compiler/compiled-board.model';
import { SimulationService } from '../../simulation/simulation.service';
import { LoggingService } from '../../logging/logging.service';
import { ToastService } from '../../logging/toast.service';
import { TranslationService } from '../../translation/translation.service';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponent } from './custom-component';

/** One breadcrumb level of an open watch. */
export interface WatchLevel {
  readonly name: string;
  readonly path: string;
  readonly session: WatchSession;
  /** Cleared by the renderer after it first fits this level's viewport. */
  needsFit: boolean;
}

/**
 * Live view of a placed custom component's inner circuit during simulation —
 * the inspection every custom config declares. Opens a fresh headless copy of
 * the instance's frozen snapshot circuit whose wires/ports light from the
 * running engine (via a {@link WatchSession} resolved through the compiled
 * board's watch index). Fully interactive: inner switches/buttons drive their
 * engine units, nested customs drill down as breadcrumb levels (parents kept
 * for back navigation), and inner inspectables (ROM) open their regular data
 * inspectors on the watch copies — tracked so they close when their level
 * goes away. The renderer owns canvas and viewport; this model owns the
 * level stack.
 */
export class SubCircuitWatch extends ComponentInspection {
  public readonly renderer = SubCircuitWatchComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 640, height: 480 },
    min: { width: 320, height: 240 }
  };
  // The canvas needs the space — on compact the watch takes the screen over
  // instead of sharing the bottom sheet.
  public override readonly compactPresentation = 'fullscreen' as const;

  private readonly simulation = getStaticDI(SimulationService);
  private readonly board: CompiledBoard;

  private readonly _levels = signal<WatchLevel[]>([]);
  /** The breadcrumb stack; the last level is the visible one. */
  public readonly levels = this._levels.asReadonly();
  public readonly activeLevel = computed(
    () => this._levels()[this._levels().length - 1]
  );

  // Data inspections opened on this watch's copies, with the level depth
  // they belong to — closed when that level (or the watch) goes away.
  private readonly _spawned: { depth: number; component: Component }[] = [];

  private readonly _render$ = new Subject<void>();
  /** Emits when engine state changed under the view — re-blit the canvas. */
  public readonly render$: Observable<void> = this._render$.asObservable();

  constructor(component: CustomComponent) {
    super();
    const board = this.simulation.board;
    const definition = component.definition;
    if (!board || !definition.circuit) {
      throw new Error(
        `"${definition.name}" has no watchable circuit in this simulation`
      );
    }
    this.board = board;
    this._levels.set([
      this._buildLevel(
        definition.name,
        String(component.id),
        definition.circuit
      )
    ]);
    this.title = computed(() =>
      this._levels()
        .map((level) => level.name)
        .join(' › ')
    );
  }

  /**
   * The breadcrumb trail for the hosting header: one segment per level,
   * ancestors clickable (navigate back), the visible level plain.
   */
  public override readonly titleParts: Signal<readonly InspectionTitlePart[]> =
    computed(() =>
      this._levels().map((level, index, levels) => ({
        label: level.name,
        ...(index < levels.length - 1
          ? { navigate: () => this.navigateTo(index) }
          : {})
      }))
    );

  /** Routes a click on a component of the active level's fresh copy. */
  public activate(component: Component): void {
    const level = this.activeLevel();
    const bodyIndex = level.session.components.indexOf(component);
    if (bodyIndex < 0) {
      return;
    }
    if (component instanceof CustomComponent) {
      this._drillInto(level, bodyIndex, component);
      return;
    }
    const unitIndex = level.session.info.unitIndexFor(bodyIndex);
    if (unitIndex !== undefined) {
      this.simulation.triggerUnitInput(unitIndex, component, () =>
        level.session.project.triggerTicker('single')
      );
      return;
    }
    if (component.config.inspection) {
      getStaticDI(InspectionService).openFor(component);
      this._spawned.push({ depth: this._levels().length - 1, component });
    }
  }

  /** Breadcrumb navigation: pops every level deeper than `index`. */
  public navigateTo(index: number): void {
    const levels = this._levels();
    if (index < 0 || index >= levels.length - 1) {
      return;
    }
    this._closeSpawned(index + 1);
    for (const level of levels.slice(index + 1)) {
      level.session.destroy();
    }
    this._levels.set(levels.slice(0, index + 1));
  }

  public override onFrame(): void {
    // Every level stays registered while open, so background (parent) levels
    // keep tracking the engine — cheap, and back navigation is instant.
    let needsRender = false;
    for (const level of this._levels()) {
      if (level.session.onFrame() && level === this.activeLevel()) {
        needsRender = true;
      }
    }
    if (needsRender) {
      this._render$.next();
    }
  }

  public override destroy(): void {
    this._closeSpawned(0);
    for (const level of this._levels()) {
      level.session.destroy();
    }
    this._levels.set([]);
  }

  private _drillInto(
    parent: WatchLevel,
    bodyIndex: number,
    copy: CustomComponent
  ): void {
    const definition = copy.definition;
    if (!definition.circuit) {
      getStaticDI(ToastService).warn(
        getStaticDI(TranslationService).translate('watch.noInnerCircuit'),
        'SubCircuitWatch'
      );
      return;
    }
    const path = `${parent.path}/${bodyIndex}`;
    this._levels.update((levels) => [
      ...levels,
      this._buildLevel(definition.name, path, definition.circuit!)
    ]);
  }

  private _buildLevel(
    name: string,
    path: string,
    circuit: SerializedCircuitBody
  ): WatchLevel {
    const info = this.board.watch.infoFor(path);
    if (!info) {
      getStaticDI(LoggingService).error(
        `no watch info for "${name}" at path "${path}"`,
        'SubCircuitWatch'
      );
      throw new Error(`"${name}" has no watchable circuit in this simulation`);
    }
    return {
      name,
      path,
      session: new WatchSession(circuit, info, this.board.descriptor.links),
      needsFit: true
    };
  }

  /** Closes spawned data inspections living at `depth` or deeper. */
  private _closeSpawned(depth: number): void {
    const inspectionService = getStaticDI(InspectionService);
    for (let i = this._spawned.length - 1; i >= 0; i--) {
      if (this._spawned[i].depth < depth) {
        continue;
      }
      const [spawned] = this._spawned.splice(i, 1);
      const entry = inspectionService
        .open()
        .find((candidate) => candidate.component === spawned.component);
      if (entry) {
        inspectionService.close(entry);
      }
    }
  }
}
