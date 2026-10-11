import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { Component } from '../components/component';
import {
  isUserInput,
  LevelUserInput,
  PulseUserInput,
  UserInput
} from '../components/user-input';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';
import { Project, UserInputEvent, UserInputPhase } from '../project/project';
import { ProjectService } from '../project/project.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { BuiltInComponentType } from '@logigator/core';
import { BoardCompilerService } from './compiler/board-compiler.service';
import { CompiledBoard, TOP_LEVEL_PATH } from './compiler/compiled-board.model';
import { CompileDiagnostic } from './compiler/compile-error';
import { LinkStateApplier, SnapshotApplier } from './state/link-state-applier';
import { MIN_TARGET_HZ } from './worker/pacing';
import { INPUT_EVENT_CONT, INPUT_EVENT_PULSE } from './worker/protocol';
import {
  SimulationRunMode,
  SimulationWorkerService
} from './worker/simulation-worker.service';

const PULSE_BUTTON_FLASH_MS = 150;

/**
 * Session lifecycle: `inactive` outside simulation mode, `starting` while the
 * worker boots the WASM engine, then `ready` (paused) ⇄ `running`.
 */
export type SimulationState = 'inactive' | 'starting' | 'ready' | 'running';

/**
 * Facade for the simulation lifecycle: entering/leaving simulation mode,
 * compiling the active circuit, the run controls, and forwarding canvas user
 * input to the engine.
 */
@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly compiler = inject(BoardCompilerService);
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly logging = inject(LoggingService);
  private readonly toastService = inject(ToastService);
  private readonly workerService = inject(SimulationWorkerService);
  private readonly settings = inject(EditorSettingsService);
  private readonly analytics = inject(AnalyticsService);

  private readonly _state = signal<SimulationState>('inactive');
  public readonly state = computed(this._state);
  /** True once the engine is up — the run controls are live. */
  public readonly isReady = computed(
    () => this._state() === 'ready' || this._state() === 'running'
  );
  public readonly isRunning = computed(() => this._state() === 'running');

  private readonly _mode = signal<SimulationRunMode>('sync');
  public readonly mode = computed(this._mode);
  private readonly _targetHz = signal(1000);
  public readonly targetHz = computed(this._targetHz);

  private readonly _clockDelays = signal<readonly number[]>([]);
  /**
   * The distinct delays, in ticks, of every clock the session's board holds
   * (custom components' inner clocks included), ascending — what turns a tick
   * rate into the frequencies the circuit's clocks run at.
   */
  public readonly clockDelays = computed(this._clockDelays);

  public readonly measuredHz = this.workerService.measuredHz;
  public readonly tick = this.workerService.tick;

  // A Subject, not a signal: it marks "fresh engine state is on the
  // components" rather than carrying a value, and fires at snapshot rate.
  private readonly _frame$ = new Subject<void>();
  /** Emits after each applied snapshot (and after a stop()'s visual reset). */
  public readonly frame$: Observable<void> = this._frame$.asObservable();

  // Compiled artifacts live for one session. Editing is locked in between, so
  // the mapping's live object references stay valid.
  private _board: CompiledBoard | null = null;
  private _applier: LinkStateApplier | null = null;
  private _project: Project | null = null;
  private _userInputSub?: Subscription;
  // Every snapshot applied to the board applier is fanned out to these too.
  private readonly _watchAppliers = new Set<SnapshotApplier>();
  // `level` slots currently high, the board's and a watch's copies alike,
  // with what setting each low needs — so a stop or exit can reset every one
  // of them.
  private readonly _highLevels = new Map<
    Component & LevelUserInput,
    Map<number, { unitIndex: number | undefined; repaint: () => void }>
  >();

  constructor() {
    // The compiled session addresses the main project's live components and
    // wires, so it cannot outlive a main-slot swap. The notification fires
    // synchronously before the swap, so this teardown still reaches the
    // outgoing project's sim visuals and ticker.
    this.projectService.mainProjectReplaced$.subscribe(() => this.exit());

    const shortcutService = inject(ShortcutService);
    shortcutService.on(ShortcutActionEnum.CANCEL).subscribe(() => this.exit());
    shortcutService.on(ShortcutActionEnum.TOGGLE_SIMULATION).subscribe(() => {
      if (this.workModeService.mode() === WorkMode.SIMULATION) {
        this.exit();
      } else {
        void this.enter();
      }
    });
  }

  public get applier(): LinkStateApplier | null {
    return this._applier;
  }

  public get board(): CompiledBoard | null {
    return this._board;
  }

  /**
   * Debug telemetry: full vs delta snapshots applied, and how many visible link
   * flips they carried on average. Null when no session is live.
   */
  public get snapshotStats(): {
    full: number;
    delta: number;
    total: number;
    switchedLinks: number;
    totalLinks: number;
    avgSwitchedPerFrame: number;
    avgSwitchedPercent: number;
  } | null {
    const applier = this._applier;
    if (!applier) {
      return null;
    }
    const { full, delta } = this.workerService.snapshotCounts;
    const total = full + delta;
    const totalLinks = applier.totalLinks;
    const avgSwitchedPerFrame = total > 0 ? applier.switchedLinks / total : 0;
    return {
      full,
      delta,
      total,
      switchedLinks: applier.switchedLinks,
      totalLinks,
      avgSwitchedPerFrame,
      avgSwitchedPercent:
        totalLinks > 0 ? (avgSwitchedPerFrame / totalLinks) * 100 : 0
    };
  }

  /**
   * Registers a secondary applier (a watch over an inner circuit) to receive
   * every snapshot alongside the board applier, returning its unregister
   * function. Registrations do not survive the session.
   */
  public registerApplier(applier: SnapshotApplier): () => void {
    this._watchAppliers.add(applier);
    return () => this._watchAppliers.delete(applier);
  }

  /**
   * Pulls one full snapshot from the engine (running or paused), so a freshly
   * registered watch applier starts from complete state instead of
   * accumulating future deltas over darkness.
   */
  public requestSnapshot(): void {
    this.workerService.requestSnapshot();
  }

  /**
   * Switches to the main project, compiles it, enters simulation mode, and
   * boots the worker. Any compile diagnostic blocks entry, surfacing as a toast
   * with the previous mode kept; a worker failure reports and leaves simulation
   * mode. Resolves once the engine is up (or the attempt was abandoned) with
   * the diagnostics that blocked it.
   */
  public async enter(): Promise<CompileDiagnostic[]> {
    if (this.workModeService.mode() === WorkMode.SIMULATION) {
      return [];
    }
    // Simulation always runs the main project, even with a custom-component
    // editor as the active tab.
    const mainProject = this.projectService.mainProject();
    if (mainProject && this.projectService.activeProject() !== mainProject) {
      this.projectService.setActiveProject(mainProject);
    }
    const project = this.projectService.activeProject();
    if (!project) {
      this.logging.info(
        'enter skipped: no active project',
        'SimulationService'
      );
      return [];
    }

    const board = this.compiler.compile(project);
    if (board.diagnostics.length > 0) {
      this.toastService.error(
        board.diagnostics.map((d) => d.message).join('\n'),
        'SimulationService'
      );
      this.analytics.capture(AnalyticsEvent.SimulationCompileBlocked, {
        kinds: board.diagnostics.map((d) => d.kind)
      });
      return board.diagnostics;
    }

    this._board = board;
    this._clockDelays.set(clockDelaysOf(board));
    const applier = new LinkStateApplier(
      board.mapping.get(TOP_LEVEL_PATH) ?? []
    );
    this._applier = applier;
    this._project = project;
    // A negated input reads high while its net is low, and the displays that
    // read it show that only inside a session. The engine reports a link that
    // never changes, so nothing else would tell them.
    for (const component of project.components) {
      component.setSimulating(true);
    }
    project.triggerTicker('single');
    this._userInputSub = project.userInput$.subscribe((event) =>
      this._onUserInput(event)
    );
    this.workModeService.setSimulationMode(true);

    this._state.set('starting');
    await this.workerService
      .startSession(board.descriptor, {
        applier: {
          applyDelta: (ids, values) => {
            applier.applyDelta(ids, values);
            for (const watch of this._watchAppliers) {
              watch.applyDelta(ids, values);
            }
          },
          applyFull: (bits) => {
            applier.applyFull(bits);
            for (const watch of this._watchAppliers) {
              watch.applyFull(bits);
            }
          }
        },
        repaint: () => this._project?.triggerTicker('single'),
        onFrame: () => this._frame$.next(),
        onError: (message) => {
          this.toastService.error(message, 'SimulationService');
          this.exit();
        }
      })
      .then(() => {
        if (this._state() === 'starting') {
          this._state.set('ready');
          this.logging.info('engine ready', 'SimulationService');
          if (this.settings.autoStartSimulation.value()) {
            this.play();
          }
        }
      })
      .catch((err: Error) => {
        if (this._state() === 'starting') {
          this.toastService.error(err.message, 'SimulationService', err);
          this.exit();
        }
      });
    return [];
  }

  /** Stops the session, resets all sim visuals, and restores SELECT mode. */
  public exit(): void {
    if (this.workModeService.mode() !== WorkMode.SIMULATION) {
      return;
    }
    this._userInputSub?.unsubscribe();
    this._userInputSub = undefined;
    this.workerService.endSession();
    this._state.set('inactive');
    this._watchAppliers.clear();

    // The reset walks live objects the board mapped at compile time, so one
    // freed under the session throws here. Dropping the session regardless
    // keeps that a single failure: a mode left at SIMULATION with the worker
    // already gone makes every retry re-enter and fail again.
    try {
      // With the engine gone, setting a level low is visual only.
      this._resetLevels();
      this._applier?.reset();
      if (this._project && !this._project.destroyed) {
        for (const component of this._project.components) {
          component.clearSimState();
          component.setSimulating(false);
        }
        this._project.triggerTicker('off');
      }
    } finally {
      this._board = null;
      this._clockDelays.set([]);
      this._applier = null;
      this._project = null;
      this.workModeService.setSimulationMode(false);
    }
  }

  /** Starts running in the selected mode; the ticker renders continuously. */
  public play(): void {
    if (this._state() !== 'ready') {
      return;
    }
    this._state.set('running');
    this.logging.info(
      `run started: mode=${this._mode()}, target=${this.targetHz()} Hz`,
      'SimulationService'
    );
    this._project?.triggerTicker('on');
    this.workerService
      .start(this._mode(), this.targetHz())
      .catch((err: Error) => this._onRunControlError(err));
  }

  /** Interrupts the run; the engine state stays put for step/play. */
  public pause(): void {
    if (this._state() !== 'running') {
      return;
    }
    this._state.set('ready');
    this.logging.info('run paused', 'SimulationService');
    this._project?.triggerTicker('off');
    this.workerService.pause().catch((err: Error) => {
      this._onRunControlError(err);
    });
  }

  /** One engine tick while paused. */
  public step(): void {
    if (this._state() !== 'ready') {
      return;
    }
    this.workerService.step().catch((err: Error) => {
      this._onRunControlError(err);
    });
  }

  /** Resets the simulation to tick 0 and clears all powered visuals. */
  public stop(): void {
    if (!this.isReady()) {
      return;
    }
    if (this._state() === 'running') {
      this._project?.triggerTicker('off');
    }
    this._state.set('ready');
    this.logging.info('simulation reset to tick 0', 'SimulationService');
    this.workerService
      .reset()
      .then(() => {
        // Set low against the rebuilt engine: a press or toggle that landed
        // while the reset was in flight reached it, and must not outlive its
        // visual.
        this._resetLevels();
        this._applier?.reset();
        if (this._project && !this._project.destroyed) {
          for (const component of this._project.components) {
            component.clearSimState();
          }
          this._project.triggerTicker('single');
        }
        // The reset changed port power without a snapshot.
        this._frame$.next();
      })
      .catch((err: Error) => this._onRunControlError(err));
  }

  /**
   * Sets the fixed-speed rate and switches to target mode, since entering a
   * speed is asking for it. Non-finite input or a rate below
   * {@link MIN_TARGET_HZ} is ignored, so the last valid rate keeps driving the
   * sim.
   */
  public setTargetHz(hz: number): void {
    if (!Number.isFinite(hz) || hz < MIN_TARGET_HZ) {
      return;
    }
    if (hz === this._targetHz() && this._mode() === 'target') {
      return;
    }
    this._targetHz.set(hz);
    this._paceToTarget();
  }

  /** Selects how the run is paced, re-pacing an active run. */
  public setMode(mode: SimulationRunMode): void {
    if (mode === this._mode()) {
      return;
    }
    this._mode.set(mode);
    this._restartIfRunning();
  }

  private _paceToTarget(): void {
    this._mode.set('target');
    this._restartIfRunning();
  }

  private _restartIfRunning(): void {
    if (this._state() !== 'running') {
      return;
    }
    this.workerService
      .start(this._mode(), this.targetHz())
      .catch((err: Error) => this._onRunControlError(err));
  }

  private _onRunControlError(err: Error): void {
    if (!this.isReady()) {
      return;
    }
    this.toastService.error(err.message, 'SimulationService', err);
    if (this._state() === 'running') {
      this._state.set('ready');
      this._project?.triggerTicker('off');
    }
  }

  private _onUserInput({ component, phase, slot }: UserInputEvent): void {
    this._operate(
      component,
      this._board?.userInputs.get(component.id),
      phase,
      () => this._project?.triggerTicker('single'),
      slot
    );
  }

  /**
   * Drives a user input whose engine unit index is already resolved: an inner
   * user input operated in a watch, where `component` is the watch's fresh
   * copy and `unitIndex` comes from `infoFor(path).unitIndexFor(bodyIndex)` —
   * the input's first unit, which `slot` offsets. `phase` is read through the
   * input's `gesture`, as a canvas operation is. `repaint` re-blits whatever
   * canvas shows the component.
   */
  public triggerUnitInput(
    unitIndex: number,
    component: Component,
    repaint: () => void,
    phase: UserInputPhase = 'tap',
    slot = 0
  ): void {
    this._operate(component, unitIndex, phase, repaint, slot);
  }

  /**
   * Drives one slot of a top-level user input to an **absolute** state,
   * which its `drive` alone decides: a `level` slot is set to `value` — one
   * already there is left alone, so repeating the call sends no further
   * engine event — and a `pulse` slot pulses on `true` and ignores `false`,
   * holding no state to clear. Reports whether the component is a user input
   * of the running session with that slot.
   */
  public setUserInput(componentId: number, value: boolean, slot = 0): boolean {
    const component = this._project?.getComponentById(componentId);
    const unitIndex = this._board?.userInputs.get(componentId);
    if (!component || unitIndex === undefined) {
      return false;
    }
    return this._setAbsolute(
      component,
      unitIndex,
      value,
      () => this._project?.triggerTicker('single'),
      slot
    );
  }

  /**
   * {@link setUserInput} for a user input whose engine unit index is already
   * resolved — an inner one of a watch, as in {@link triggerUnitInput}.
   * Reports whether the component is a user input with that slot.
   */
  public setUnitInput(
    unitIndex: number,
    component: Component,
    value: boolean,
    repaint: () => void,
    slot = 0
  ): boolean {
    return this._setAbsolute(component, unitIndex, value, repaint, slot);
  }

  private _setAbsolute(
    component: Component,
    unitIndex: number,
    value: boolean,
    repaint: () => void,
    slot: number
  ): boolean {
    if (!isUserInput(component) || !isSlotOf(component, slot)) {
      return false;
    }
    const unit = unitOfSlot(unitIndex, slot);
    if (component.drive === 'level') {
      this._setLevel(component, slot, unit, value, repaint);
    } else if (value) {
      this._pulse(component, slot, unit, repaint);
    }
    return true;
  }

  /**
   * Records a `level` slot the engine already holds high — a watch copy posed
   * from its output link — as active, sending no event, so a stop, an exit or
   * the copy's teardown sets it low like any other. `unitIndex` is the
   * input's first unit, as in {@link triggerUnitInput}.
   */
  public adoptHighLevel(
    unitIndex: number,
    component: Component,
    repaint: () => void,
    slot = 0
  ): void {
    if (
      !this.isReady() ||
      !isUserInput(component) ||
      component.drive !== 'level' ||
      !isSlotOf(component, slot)
    ) {
      return;
    }
    this._trackLevel(component, slot, unitOfSlot(unitIndex, slot), repaint);
    component.setActive(slot, true);
    repaint();
  }

  /**
   * A pointer operation on a slot, mapped through the input's `gesture`: a
   * `hold` slot is set high on press and low on release, a `toggle` slot
   * flips on a tap, a `tap` (pulse) slot pulses on a tap. A phase the gesture
   * does not use, and a slot the input does not have, is ignored.
   */
  private _operate(
    component: Component,
    unitIndex: number | undefined,
    phase: UserInputPhase,
    repaint: () => void,
    slot: number
  ): void {
    if (!isUserInput(component) || !isSlotOf(component, slot)) {
      return;
    }
    const unit = unitOfSlot(unitIndex, slot);
    if (component.drive === 'pulse') {
      if (phase === 'tap') {
        this._pulse(component, slot, unit, repaint);
      }
    } else if (component.gesture === 'hold') {
      if (phase !== 'tap') {
        this._setLevel(component, slot, unit, phase === 'press', repaint);
      }
    } else if (phase === 'tap') {
      this._setLevel(component, slot, unit, !component.isActive(slot), repaint);
    }
  }

  /**
   * Sets one `level` slot high or low with `INPUT_EVENT_CONT`; a slot already
   * there is left alone, so the engine never sees the same state twice.
   * Setting it high obeys {@link _pulse}'s readiness rule, while setting it
   * low always clears the visual and reaches the engine whenever one is up.
   * `unitIndex` is the slot's own unit.
   */
  private _setLevel(
    input: Component & LevelUserInput,
    slot: number,
    unitIndex: number | undefined,
    high: boolean,
    repaint: () => void
  ): void {
    if (input.isActive(slot) === high) {
      return;
    }
    if (high) {
      if (!this.isReady()) {
        return;
      }
      this._trackLevel(input, slot, unitIndex, repaint);
    } else {
      this._forgetLevel(input, slot);
    }
    input.setActive(slot, high);
    if (unitIndex !== undefined && this.isReady()) {
      this.workerService.triggerInput(unitIndex, INPUT_EVENT_CONT, [high]);
    }
    repaint();
  }

  private _trackLevel(
    input: Component & LevelUserInput,
    slot: number,
    unitIndex: number | undefined,
    repaint: () => void
  ): void {
    let slots = this._highLevels.get(input);
    if (!slots) {
      slots = new Map();
      this._highLevels.set(input, slots);
    }
    slots.set(slot, { unitIndex, repaint });
  }

  private _forgetLevel(input: Component & LevelUserInput, slot: number): void {
    const slots = this._highLevels.get(input);
    slots?.delete(slot);
    if (slots?.size === 0) {
      this._highLevels.delete(input);
    }
  }

  /** Sets every high `level` slot low, the engine's unit included. */
  private _resetLevels(): void {
    for (const [input, slots] of [...this._highLevels]) {
      for (const [slot, { unitIndex, repaint }] of [...slots]) {
        if (!input.destroyed) {
          this._setLevel(input, slot, unitIndex, false, repaint);
          continue;
        }
        // A copy freed while high has nothing left to draw, but its engine
        // unit still reads high.
        this._forgetLevel(input, slot);
        if (unitIndex !== undefined && this.isReady()) {
          this.workerService.triggerInput(unitIndex, INPUT_EVENT_CONT, [false]);
        }
      }
    }
  }

  /**
   * Pulses one `pulse` slot: `INPUT_EVENT_PULSE` (one tick), with the slot
   * flashing active for {@link PULSE_BUTTON_FLASH_MS}.
   */
  private _pulse(
    input: Component & PulseUserInput,
    slot: number,
    unitIndex: number | undefined,
    repaint: () => void
  ): void {
    // Inputs are live from the moment simulation mode is entered, while the
    // engine is still starting. The worker drops inputs from that window, so
    // changing the visuals would show a state the engine never received.
    if (!this.isReady()) {
      return;
    }
    input.setActive(slot, true);
    if (unitIndex !== undefined) {
      this.workerService.triggerInput(unitIndex, INPUT_EVENT_PULSE, [true]);
    }
    setTimeout(() => {
      if (!input.destroyed) {
        input.setActive(slot, false);
        repaint();
      }
    }, PULSE_BUTTON_FLASH_MS);
    repaint();
  }
}

function isSlotOf(input: UserInput, slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < input.inputSlots;
}

/**
 * Where a slot becomes an engine unit: a user input's units are contiguous
 * from its first, `base`, slot `i` at `base + i`. Callers resolve and pass
 * the base only.
 */
function unitOfSlot(
  base: number | undefined,
  slot: number
): number | undefined {
  return base === undefined ? undefined : base + slot;
}

function clockDelaysOf(board: CompiledBoard): number[] {
  const delays = new Set<number>();
  for (const unit of board.descriptor.components) {
    if (unit.type === BuiltInComponentType.CLOCK && unit.ops) {
      delays.add(unit.ops[0]);
    }
  }
  return [...delays].sort((a, b) => a - b);
}
