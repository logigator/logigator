import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { Component } from '../components/component';
import { ButtonComponent } from '../components/component-types/button/button.component';
import { LeverComponent } from '../components/component-types/lever/lever.component';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { BoardCompilerService } from './compiler/board-compiler.service';
import { CompiledBoard, TOP_LEVEL_PATH } from './compiler/compiled-board.model';
import { LinkStateApplier, SnapshotApplier } from './state/link-state-applier';
import { INPUT_EVENT_CONT, INPUT_EVENT_PULSE } from './worker/protocol';
import {
  SimulationRunMode,
  SimulationWorkerService
} from './worker/simulation-worker.service';

/** How long a clicked button shows its pressed state. */
const BUTTON_FLASH_MS = 150;

/**
 * Session lifecycle: `inactive` outside simulation mode, `starting` while the
 * worker boots the WASM engine, then `ready` (paused) ⇄ `running`.
 */
export type SimulationState = 'inactive' | 'starting' | 'ready' | 'running';

/** Unit the target speed is entered in; multiplies the typed value to Hz. */
export type TargetSpeedUnit = 'Hz' | 'kHz' | 'MHz';

const TARGET_SPEED_MULTIPLIER: Record<TargetSpeedUnit, number> = {
  Hz: 1,
  kHz: 1_000,
  MHz: 1_000_000
};

/**
 * Facade for the simulation lifecycle: entering/leaving simulation mode,
 * compiling the active circuit, the run controls (play/pause/step/stop and
 * the run-mode selection), and forwarding canvas user input to the engine.
 */
@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly compiler = inject(BoardCompilerService);
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly toastService = inject(ToastService);
  private readonly workerService = inject(SimulationWorkerService);

  private readonly _state = signal<SimulationState>('inactive');
  public readonly state = computed(this._state);
  /** True once the engine is up — the run controls are live. */
  public readonly isReady = computed(
    () => this._state() === 'ready' || this._state() === 'running'
  );
  public readonly isRunning = computed(() => this._state() === 'running');

  private readonly _mode = signal<SimulationRunMode>('sync');
  public readonly mode = computed(this._mode);
  // Target speed is held as the typed value plus its unit; the Hz the engine
  // is paced at is derived. Switching unit keeps the typed value and re-reads
  // it in the new unit (10 Hz → 10 kHz), so the value never changes on its own.
  private readonly _targetValue = signal(1000);
  public readonly targetValue = computed(this._targetValue);
  private readonly _targetUnit = signal<TargetSpeedUnit>('Hz');
  public readonly targetUnit = computed(this._targetUnit);
  public readonly targetHz = computed(
    () => this._targetValue() * TARGET_SPEED_MULTIPLIER[this._targetUnit()]
  );

  public readonly measuredHz = this.workerService.measuredHz;
  public readonly tick = this.workerService.tick;

  // The per-snapshot frame hook, fanned out to live inspections. A plain
  // Subject (not a signal): it marks "fresh engine state is on the components"
  // rather than carrying a value, and fires at snapshot rate.
  private readonly _frame$ = new Subject<void>();
  /** Emits after each applied snapshot (and after a stop()'s visual reset). */
  public readonly frame$: Observable<void> = this._frame$.asObservable();

  // Compiled artifacts live for one session: rebuilt on every enter(),
  // discarded on exit(). Editing is locked in between, so the mapping's live
  // object references stay valid.
  private _board: CompiledBoard | null = null;
  private _applier: LinkStateApplier | null = null;
  private _project: Project | null = null;
  private _userInputSub?: Subscription;
  // Watch appliers registered by open inner-circuit views; every snapshot the
  // bridge applies to the board applier is fanned out to these too.
  private readonly _watchAppliers = new Set<SnapshotApplier>();

  constructor() {
    const shortcutService = inject(ShortcutService);
    shortcutService.on(ShortcutActionEnum.CANCEL).subscribe(() => this.exit());
    shortcutService.on(ShortcutActionEnum.TOGGLE_SIMULATION).subscribe(() => {
      if (this.workModeService.mode() === WorkMode.SIMULATION) {
        this.exit();
      } else {
        this.enter();
      }
    });
  }

  /** The current session's link applier (the worker bridge feeds it deltas). */
  public get applier(): LinkStateApplier | null {
    return this._applier;
  }

  /** The current session's compiled board. */
  public get board(): CompiledBoard | null {
    return this._board;
  }

  /**
   * Registers a secondary applier (a watch over an inner circuit) to receive
   * every snapshot alongside the board applier. Returns the unregister
   * function. The registration does not survive the session — exit() clears
   * all watch appliers.
   */
  public registerApplier(applier: SnapshotApplier): () => void {
    this._watchAppliers.add(applier);
    return () => this._watchAppliers.delete(applier);
  }

  /**
   * Pulls one full snapshot from the engine (running or paused) — call after
   * registering a watch applier so it starts from complete state instead of
   * accumulating future deltas over darkness.
   */
  public requestSnapshot(): void {
    this.workerService.requestSnapshot();
  }

  /**
   * Compiles the active project, enters simulation mode, and boots the
   * worker. On compile diagnostics, surfaces a toast and stays in the
   * previous mode; on worker failure, reports and leaves simulation mode.
   */
  public enter(): void {
    if (this.workModeService.mode() === WorkMode.SIMULATION) {
      return;
    }
    const project = this.projectService.activeProject();
    if (!project) {
      return;
    }

    const board = this.compiler.compile(project);
    if (board.diagnostics.length > 0) {
      this.toastService.error(
        board.diagnostics.map((d) => d.message).join('\n')
      );
      return;
    }

    this._board = board;
    const applier = new LinkStateApplier(
      board.mapping.get(TOP_LEVEL_PATH) ?? []
    );
    this._applier = applier;
    this._project = project;
    this._userInputSub = project.userInput$.subscribe((component) =>
      this._onUserInput(component)
    );
    this.workModeService.setSimulationMode(true);

    this._state.set('starting');
    this.workerService
      .startSession(board.descriptor, {
        // Fan-out: the board applier first, then every registered watch.
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
          this.toastService.error(message);
          this.exit();
        }
      })
      .then(() => {
        if (this._state() === 'starting') {
          this._state.set('ready');
        }
      })
      .catch((err: Error) => {
        if (this._state() === 'starting') {
          this.toastService.error(err.message);
          this.exit();
        }
      });
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

    this._applier?.reset();
    if (this._project && !this._project.destroyed) {
      for (const component of this._project.components) {
        component.clearSimState();
      }
      this._project.triggerTicker('off');
    }

    this._board = null;
    this._applier = null;
    this._project = null;
    this.workModeService.setSimulationMode(false);
  }

  /** Starts running in the selected mode; the ticker renders continuously. */
  public play(): void {
    if (this._state() !== 'ready') {
      return;
    }
    this._state.set('running');
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
    this.workerService
      .reset()
      .then(() => {
        this._applier?.reset();
        if (this._project && !this._project.destroyed) {
          for (const component of this._project.components) {
            component.clearSimState();
          }
          this._project.triggerTicker('single');
        }
        // The reset changed port power without a snapshot; refresh inspections.
        this._frame$.next();
      })
      .catch((err: Error) => this._onRunControlError(err));
  }

  /**
   * Sets the typed target-speed value (in the current unit). Invalid input —
   * non-finite or non-positive, e.g. an emptied field mid-edit — is ignored so
   * the last valid value keeps driving the sim and the box isn't rewritten
   * under the user's caret.
   */
  public setTargetValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    if (value === this._targetValue()) {
      return;
    }
    this._targetValue.set(value);
    if (this._mode() === 'target') {
      this._restartIfRunning();
    }
  }

  /** Switches the unit the typed value is read in, re-pacing if running. */
  public setTargetUnit(unit: TargetSpeedUnit): void {
    if (unit === this._targetUnit()) {
      return;
    }
    this._targetUnit.set(unit);
    if (this._mode() === 'target') {
      this._restartIfRunning();
    }
  }

  public toggleTargetMode(): void {
    this._mode.update((m) => (m === 'target' ? 'continuous' : 'target'));
    this._restartIfRunning();
  }

  public toggleSyncMode(): void {
    this._mode.update((m) => (m === 'sync' ? 'continuous' : 'sync'));
    this._restartIfRunning();
  }

  /** Re-paces an active run after a mode or target-rate change. */
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
    this.toastService.error(err.message);
    if (this._state() === 'running') {
      this._state.set('ready');
      this._project?.triggerTicker('off');
    }
  }

  private _onUserInput(component: Component): void {
    this._activate(component, this._board?.userInputs.get(component.id), () =>
      this._project?.triggerTicker('single')
    );
  }

  /**
   * Activates a lever/button whose engine unit index is already resolved —
   * the path for inner user inputs clicked in a watch, where `component` is
   * the watch's fresh copy (its visuals toggle/flash) and `unitIndex` comes
   * from the watch index (`infoFor(path).unitIndexFor(bodyIndex)`). `repaint`
   * re-blits whatever canvas shows the component.
   */
  public triggerUnitInput(
    unitIndex: number,
    component: Component,
    repaint: () => void
  ): void {
    this._activate(component, unitIndex, repaint);
  }

  /** Shared lever/button activation: visuals plus the engine input event. */
  private _activate(
    component: Component,
    unitIndex: number | undefined,
    repaint: () => void
  ): void {
    if (component instanceof LeverComponent) {
      component.toggle();
      if (unitIndex !== undefined) {
        this.workerService.triggerInput(unitIndex, INPUT_EVENT_CONT, [
          component.isOn
        ]);
      }
    } else if (component instanceof ButtonComponent) {
      component.setPressed(true);
      if (unitIndex !== undefined) {
        this.workerService.triggerInput(unitIndex, INPUT_EVENT_PULSE, [true]);
      }
      setTimeout(() => {
        if (!component.destroyed) {
          component.setPressed(false);
          repaint();
        }
      }, BUTTON_FLASH_MS);
    }
    repaint();
  }
}
