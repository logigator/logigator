import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component } from '../components/component';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { InspectionPresenter, OpenInspection } from './inspection-presenter';
import { WindowInspectionPresenter } from './window-inspection.presenter';

/**
 * Orchestrates live component inspections: while a simulation runs, tapping an
 * inspectable component (its config declares an `inspection` factory) opens a
 * live view of it — at most one per component instance; a second tap focuses
 * the existing one. Views are framed by an {@link InspectionPresenter}
 * (floating windows on desktop); leaving simulation mode closes everything.
 *
 * Live data is pull-based: {@link SimulationService.frame$} fires after each
 * applied snapshot and this service fans it out to every open inspection's
 * `onFrame`, which re-reads main-thread state (options, port power).
 */
@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly windowPresenter = inject(WindowInspectionPresenter);

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
    const entry: OpenInspection = {
      component,
      inspection: factory(component)
    };
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

  /** Compact gets its own presenter with the inspection sheet. */
  private _presenter(): InspectionPresenter {
    return this.windowPresenter;
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
