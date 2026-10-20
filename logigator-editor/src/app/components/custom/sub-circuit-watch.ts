import { computed, signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Component } from '../component';
import {
  ComponentInspection,
  InputFrame,
  InputRoute,
  InspectionTitlePart,
  SlotOperation,
  StateRoute
} from '../component-inspection';
import { isUserInput, UserInput } from '../user-input';
import { InspectionService } from '../../inspection/inspection.service';
import { WatchSession } from '../../inspection/watch/watch-session';
import { SubCircuitWatchComponent } from '../../inspection/watch/sub-circuit-watch.component';
import { isCanvasOperatedInput } from '../../rendering/interaction/body-hit';
import { SerializedCircuitBody } from '@logigator/core';
import { CompiledBoard } from '../../simulation/compiler/compiled-board.model';
import { SimulationService } from '../../simulation/simulation.service';
import { LoggingService } from '../../logging/logging.service';
import { ToastService } from '../../logging/toast.service';
import { TranslationService } from '../../translation/translation.service';
import { getStaticDI } from '../../utils/get-di';
import type { DocsTarget } from '../../documentation/docs-target';
import { DOCS_LINKS } from '../../documentation/docs-links';
import type { UserInputPhase } from '../../project/project';
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
 * Live view of a placed custom component's inner circuit during simulation.
 * Opens a fresh headless copy of the instance's frozen snapshot circuit, lit
 * from the running engine through a {@link WatchSession}. Fully interactive:
 * inner user inputs drive their engine inputs, nested customs drill
 * down as breadcrumb levels, and inner inspectables open their regular data
 * inspectors on the watch copies. The renderer owns canvas and viewport; this
 * model owns the level stack.
 */
export class SubCircuitWatch extends ComponentInspection {
  public readonly kind = 'watch';
  public override readonly docs = signal<DocsTarget>(DOCS_LINKS.watches);
  public readonly renderer = SubCircuitWatchComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 640, height: 480 },
    min: { width: 320, height: 240 }
  };
  // The canvas needs the whole screen on compact, not a shared bottom sheet.
  public override readonly compactPresentation = 'fullscreen' as const;

  private readonly simulation = getStaticDI(SimulationService);
  private readonly board: CompiledBoard;

  private readonly _levels = signal<WatchLevel[]>([]);
  /** The breadcrumb stack; the last level is the visible one. */
  public readonly levels = this._levels.asReadonly();
  public readonly activeLevel = computed(
    () => this._levels()[this._levels().length - 1]
  );

  // Data inspections opened on this watch's copies, with the depth they
  // belong to; closed when that level or the watch goes away.
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

  /** One segment per level; ancestors navigate back, the last is plain. */
  public override readonly titleParts: Signal<readonly InspectionTitlePart[]> =
    computed(() =>
      this._levels().map((level, index, levels) => ({
        label: level.name,
        ...(index < levels.length - 1
          ? { navigate: () => this.navigateTo(index) }
          : {})
      }))
    );

  /**
   * Routes a click on a component of the active level's fresh copy. A
   * component that declares an inspection opens it, with input and state
   * routes bound to this level and the breadcrumb leading its title, before
   * anything would trigger it as a user input. A user input operated on the
   * canvas gets a tap on its one slot, which a `hold` input ignores; a
   * multi-slot one without an inspection gets nothing.
   */
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
    if (component.config.inspection) {
      getStaticDI(InspectionService).openFor(component, {
        input: this._routeFor(level, component),
        state: this._stateRouteFor(level, bodyIndex),
        place: this._levels().map((each) => each.name)
      });
      this._spawned.push({ depth: this._levels().length - 1, component });
      return;
    }
    const unitIndex = level.session.info.unitIndexFor(bodyIndex);
    if (isCanvasOperatedInput(component) && unitIndex !== undefined) {
      this.simulation.operateUnitInput(
        unitIndex,
        component,
        [{ slot: 0, phase: 'tap' }],
        () => level.session.project.triggerTicker('single')
      );
    }
  }

  /**
   * The hold a press on one slot of a `hold` user input of the active level's
   * copy starts: `press` and `release` drive the slot's engine unit, both
   * bound to this level, so a release arriving after a level swap still
   * reaches the unit it pressed. Null for a component that is not one of the
   * level's `hold` inputs.
   */
  public holdFor(
    input: Component & UserInput,
    slot = 0
  ): { press(): void; release(): void } | null {
    return this._holdAt(this.activeLevel(), input, slot);
  }

  /** Whether the component is a user input of the active level's copy. */
  public isLevelInput(component: Component): boolean {
    return this._unitIndexAt(this.activeLevel(), component) !== undefined;
  }

  /**
   * Drives one slot of a user input of the active level's copy to an
   * **absolute** state, as `SimulationService.setUserInput` does a top-level
   * one. Reports whether the component is one of the level's user inputs
   * with that slot.
   */
  public setInput(component: Component, value: boolean, slot = 0): boolean {
    const level = this.activeLevel();
    const unitIndex = this._unitIndexAt(level, component);
    if (unitIndex === undefined) {
      return false;
    }
    return this.simulation.setUnitInput(
      unitIndex,
      component,
      value,
      () => level.session.project.triggerTicker('single'),
      slot
    );
  }

  /**
   * {@link setInput} for every slot at once, `values[i]` for slot `i`, as one
   * frame, as `SimulationService.setUserInputs` does a top-level
   * input. Reports whether the component is one of the level's user inputs
   * with exactly that many slots.
   */
  public setInputs(component: Component, values: readonly boolean[]): boolean {
    const level = this.activeLevel();
    const unitIndex = this._unitIndexAt(level, component);
    if (unitIndex === undefined) {
      return false;
    }
    return this.simulation.setUnitInputs(unitIndex, component, values, () =>
      level.session.project.triggerTicker('single')
    );
  }

  /**
   * Hands input frames to the engine input of a component of the active
   * level's copy, as `SimulationService.sendFrames` does a top-level one.
   * Reports whether the component is one of the level's inputs, every
   * frame fits its outputs and the frames fit behind its pending events.
   */
  public sendFrames(
    component: Component,
    frames: readonly InputFrame[]
  ): boolean {
    const unitIndex = this._unitIndexAt(this.activeLevel(), component);
    return (
      unitIndex !== undefined &&
      this.simulation.sendUnitFrames(unitIndex, component, frames)
    );
  }

  /**
   * Drops the frames the input of a component of the active level's copy
   * still has queued and queues `frames` in their place, as
   * `SimulationService.cancelFrames` does for a top-level one. Reports
   * whether the component is one of the level's inputs and every frame fits
   * its outputs.
   */
  public cancelFrames(
    component: Component,
    frames: readonly InputFrame[] = []
  ): boolean {
    const unitIndex = this._unitIndexAt(this.activeLevel(), component);
    return (
      unitIndex !== undefined &&
      this.simulation.cancelUnitFrames(unitIndex, component, frames)
    );
  }

  /**
   * How many event frames the input of a component of the active level's
   * copy has not yet applied, at most, as `SimulationService.pendingEvents`
   * counts a top-level one; 0 for anything but one of the level's inputs.
   */
  public pendingEvents(component: Component): number {
    const unitIndex = this._unitIndexAt(this.activeLevel(), component);
    return unitIndex === undefined
      ? 0
      : this.simulation.pendingUnitEvents(unitIndex);
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
    // Parent levels stay registered so they keep tracking the engine: cheap,
    // and back navigation is instant.
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
      session: new WatchSession(circuit, info, this.board.linkCount),
      needsFit: true
    };
  }

  /** The engine unit of a user input of `level`'s copy. */
  private _unitIndexAt(
    level: WatchLevel,
    component: Component
  ): number | undefined {
    const bodyIndex = level.session.components.indexOf(component);
    return bodyIndex < 0
      ? undefined
      : level.session.info.unitIndexFor(bodyIndex);
  }

  private _holdAt(
    level: WatchLevel,
    input: Component,
    slot: number
  ): { press(): void; release(): void } | null {
    const unitIndex = this._unitIndexAt(level, input);
    if (
      !isUserInput(input) ||
      input.gesture !== 'hold' ||
      unitIndex === undefined
    ) {
      return null;
    }
    const operate = (phase: UserInputPhase) =>
      this.simulation.operateUnitInput(
        unitIndex,
        input,
        [{ slot, phase }],
        () => level.session.project.triggerTicker('single')
      );
    return {
      press: () => operate('press'),
      release: () => operate('release')
    };
  }

  /**
   * Operates slots of a user input of `level`'s copy, its unit resolved on
   * the call.
   */
  private _operateAt(
    level: WatchLevel,
    input: Component,
    operations: readonly SlotOperation[]
  ): void {
    const unitIndex = this._unitIndexAt(level, input);
    if (unitIndex !== undefined) {
      this.simulation.operateUnitInput(unitIndex, input, operations, () =>
        level.session.project.triggerTicker('single')
      );
    }
  }

  /**
   * An inspection's route into `level`: its operations drive the copy's
   * slots, and its frames go to the copy's unit, resolved on every call.
   */
  private _routeFor(level: WatchLevel, component: Component): InputRoute {
    const unitIndex = () => this._unitIndexAt(level, component);
    return {
      operate: (operations) => this._operateAt(level, component, operations),
      send: (frames) => {
        const base = unitIndex();
        if (base !== undefined) {
          this.simulation.sendUnitFrames(base, component, frames);
        }
      },
      cancel: (frames) => {
        const base = unitIndex();
        if (base !== undefined) {
          this.simulation.cancelUnitFrames(base, component, frames);
        }
      },
      pending: () => {
        const base = unitIndex();
        return base === undefined ? 0 : this.simulation.pendingUnitEvents(base);
      }
    };
  }

  /**
   * An inspection's state route into `level`: the copy's engine state is its
   * unit's, resolved through the watch index.
   */
  private _stateRouteFor(level: WatchLevel, bodyIndex: number): StateRoute {
    return {
      watch: (onRead) => {
        const unit = level.session.info.stateUnitFor(bodyIndex);
        return unit === undefined
          ? null
          : this.simulation.watchUnitState(unit, onRead);
      }
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
