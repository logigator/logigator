import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component } from '../components/component';
import { LayoutService } from '../layout/layout.service';
import { ToastService } from '../logging/toast.service';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { InspectionPresenter, OpenInspection } from './inspection-presenter';
import { SheetInspectionPresenter } from './sheet-inspection.presenter';
import { WindowInspectionPresenter } from './window-inspection.presenter';

/**
 * Orchestrates live component inspections: while a simulation runs, tapping an
 * inspectable component (its config declares an `inspection` factory) opens a
 * live view of it — at most one per component instance; a second tap focuses
 * the existing one. Views are framed by an {@link InspectionPresenter} —
 * floating windows on desktop, the shared bottom sheet on compact, re-homed
 * live when the breakpoint flips. Leaving simulation mode closes everything.
 *
 * Live data is pull-based: {@link SimulationService.frame$} fires after each
 * applied snapshot and this service fans it out to every open inspection's
 * `onFrame`, which re-reads main-thread state (options, port power).
 */
@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly layout = inject(LayoutService);
  private readonly toastService = inject(ToastService);
  private readonly windowPresenter = inject(WindowInspectionPresenter);
  private readonly sheetPresenter = inject(SheetInspectionPresenter);

  private readonly _open = signal<readonly OpenInspection[]>([]);
  /** The open inspections, in opening order. */
  public readonly open = this._open.asReadonly();

  private requestSub?: Subscription;

  constructor() {
    const simulationService = inject(SimulationService);
    simulationService.frame$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this._onFrame());

    // Simulation mode drives the session: listen for inspect taps on the
    // active project while simulating, tear everything down on exit.
    effect(() => {
      const simulating = this.workModeService.mode() === WorkMode.SIMULATION;
      untracked(() => this._onSimulationToggled(simulating));
    });

    // Re-home open inspections when the breakpoint flips mid-session:
    // windows become sheet tabs and back.
    let wasCompact = this.layout.isCompact();
    effect(() => {
      const compact = this.layout.isCompact();
      if (compact === wasCompact) {
        return;
      }
      wasCompact = compact;
      untracked(() => this._rehome(compact));
    });
  }

  /** Opens (or focuses) the inspection for an inspectable component. */
  public openFor(component: Component): void {
    const existing = this._open().find(
      (entry) => entry.component === component
    );
    if (existing) {
      this._presenter().focus(existing);
      return;
    }
    const factory = component.config.inspection;
    if (!factory) {
      return;
    }
    let inspection;
    try {
      inspection = factory(component);
    } catch (err) {
      // A watch can legitimately fail to open (e.g. the definition no longer
      // matches the compiled board) — surface it instead of crashing the tap.
      this.toastService.error(err instanceof Error ? err.message : String(err));
      return;
    }
    const entry: OpenInspection = { component, inspection };
    this._open.update((entries) => [...entries, entry]);
    this._presenter().show(entry, () => this._remove(entry));
  }

  public close(entry: OpenInspection): void {
    this._presenter().close(entry);
    this._remove(entry);
  }

  public closeAll(): void {
    for (const entry of [...this._open()]) {
      this.close(entry);
    }
  }

  private _presenter(): InspectionPresenter {
    return this.layout.isCompact() ? this.sheetPresenter : this.windowPresenter;
  }

  /** Moves every open inspection from the previous presenter to the new one. */
  private _rehome(compact: boolean): void {
    const from = compact ? this.windowPresenter : this.sheetPresenter;
    const to = compact ? this.sheetPresenter : this.windowPresenter;
    for (const entry of this._open()) {
      from.close(entry);
      to.show(entry, () => this._remove(entry));
    }
  }

  private _onSimulationToggled(simulating: boolean): void {
    this.requestSub?.unsubscribe();
    this.requestSub = undefined;
    if (simulating) {
      this.requestSub = this.projectService
        .activeProject()
        ?.inspectRequest$.subscribe((component) => this.openFor(component));
    } else {
      this.closeAll();
    }
  }

  private _onFrame(): void {
    for (const entry of this._open()) {
      entry.inspection.onFrame?.();
    }
  }

  /** Idempotent removal — reached from close() and presenter dismissals. */
  private _remove(entry: OpenInspection): void {
    if (!this._open().includes(entry)) {
      return;
    }
    this._open.update((entries) => entries.filter((e) => e !== entry));
    entry.inspection.destroy?.();
  }
}
