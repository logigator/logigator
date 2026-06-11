import { computed, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
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
import { LinkStateApplier } from './state/link-state-applier';

/** How long a clicked button shows its pressed state. */
const BUTTON_FLASH_MS = 150;

/**
 * Facade for the simulation lifecycle: entering/leaving simulation mode,
 * compiling the active circuit, and reacting to canvas user input. The run
 * controls (play/pause/step/stop) come alive with the worker phase once the
 * WASM module ships; until then a session only locks editing and reflects
 * button/lever interaction.
 */
@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly compiler = inject(BoardCompilerService);
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly toastService = inject(ToastService);

  private readonly _simulating = signal(false);
  public readonly isSimulating = computed(this._simulating);

  // Fed by the worker phase (status polling); 0 while no simulation runs.
  private readonly _measuredHz = signal(0);
  public readonly measuredHz = computed(this._measuredHz);

  // Compiled artifacts live for one session: rebuilt on every enter(),
  // discarded on exit(). Editing is locked in between, so the mapping's live
  // object references stay valid.
  private _board: CompiledBoard | null = null;
  private _applier: LinkStateApplier | null = null;
  private _project: Project | null = null;
  private _userInputSub?: Subscription;

  constructor() {
    inject(ShortcutService)
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => this.exit());
  }

  /** The current session's link applier (worker phase feeds it deltas). */
  public get applier(): LinkStateApplier | null {
    return this._applier;
  }

  /** The current session's compiled board. */
  public get board(): CompiledBoard | null {
    return this._board;
  }

  /**
   * Compiles the active project and enters simulation mode. On compile
   * diagnostics, surfaces a toast and stays in the previous mode.
   */
  public enter(): void {
    if (this._simulating()) {
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
    this._applier = new LinkStateApplier(
      board.mapping.get(TOP_LEVEL_PATH) ?? []
    );
    this._project = project;
    this._userInputSub = project.userInput$.subscribe((component) =>
      this._onUserInput(component)
    );
    this.workModeService.setMode(WorkMode.SIMULATION);
    this._simulating.set(true);
  }

  /** Stops the session, resets all sim visuals, and restores SELECT mode. */
  public exit(): void {
    if (!this._simulating()) {
      return;
    }
    this._userInputSub?.unsubscribe();
    this._userInputSub = undefined;

    this._applier?.reset();
    if (this._project && !this._project.destroyed) {
      for (const component of this._project.components) {
        component.clearSimState();
      }
      this._project.triggerTicker('single');
    }

    this._board = null;
    this._applier = null;
    this._project = null;
    this.workModeService.setMode(WorkMode.SELECT);
    this._simulating.set(false);
  }

  private _onUserInput(component: Component): void {
    if (component instanceof LeverComponent) {
      component.toggle();
    } else if (component instanceof ButtonComponent) {
      component.setPressed(true);
      setTimeout(() => {
        if (!component.destroyed) {
          component.setPressed(false);
          this._project?.triggerTicker('single');
        }
      }, BUTTON_FLASH_MS);
    }
    // Worker phase: forward triggerInput via this._board.userInputs here.
    this._project?.triggerTicker('single');
  }
}
