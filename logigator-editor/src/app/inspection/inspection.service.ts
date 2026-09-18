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
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * Orchestrates live component inspections: while a simulation runs, tapping an
 * inspectable component opens a live view of it — at most one per instance, a
 * second tap focuses the existing one. An {@link InspectionPresenter} frames
 * the views and re-homes them when the breakpoint flips. Leaving simulation
 * mode closes everything.
 *
 * Live data is pull-based: {@link SimulationService.frame$} fires after each
 * applied snapshot and fans out to every open inspection's `onFrame`, which
 * re-reads main-thread state (options, port power).
 */
@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly layout = inject(LayoutService);
  private readonly toastService = inject(ToastService);
  private readonly windowPresenter = inject(WindowInspectionPresenter);
  private readonly sheetPresenter = inject(SheetInspectionPresenter);
  private readonly analytics = inject(AnalyticsService);

  private readonly _open = signal<readonly OpenInspection[]>([]);
  /** The open inspections, in opening order. */
  public readonly open = this._open.asReadonly();

  private requestSub?: Subscription;

  constructor() {
    const simulationService = inject(SimulationService);
    simulationService.frame$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this._onFrame());

    // Listen for inspect taps while simulating, tear down on exit.
    effect(() => {
      const simulating = this.workModeService.mode() === WorkMode.SIMULATION;
      untracked(() => this._onSimulationToggled(simulating));
    });

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
      this._presenterFor(existing).focus(existing);
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
      // A watch can legitimately fail to open (the definition no longer
      // matches the compiled board) — surface it instead of crashing the tap.
      this.toastService.error(
        err instanceof Error ? err.message : String(err),
        'InspectionService',
        err
      );
      return;
    }
    const entry: OpenInspection = { component, inspection };
    this._open.update((entries) => [...entries, entry]);
    this._presenterFor(entry).show(entry, () => this._remove(entry));
    this.analytics.capture(AnalyticsEvent.InspectionOpened, {
      kind: inspection.kind
    });
  }

  public close(entry: OpenInspection): void {
    this._presenterFor(entry).close(entry);
    this._remove(entry);
  }

  public closeAll(): void {
    for (const entry of [...this._open()]) {
      this.close(entry);
    }
  }

  /**
   * The presenter framing an entry: windows on desktop; on compact, the shared
   * sheet — except `compactPresentation: 'fullscreen'` inspections, which stay
   * windows everywhere and render as fullscreen takeovers.
   */
  private _presenterFor(
    entry: OpenInspection,
    compact = this.layout.isCompact()
  ): InspectionPresenter {
    if (!compact || entry.inspection.compactPresentation === 'fullscreen') {
      return this.windowPresenter;
    }
    return this.sheetPresenter;
  }

  /**
   * Moves every open inspection to the presenter the new breakpoint calls for.
   * Entries framed by windows on both breakpoints keep their window entry;
   * only the outlet swaps around them.
   */
  private _rehome(compact: boolean): void {
    for (const entry of this._open()) {
      const from = this._presenterFor(entry, !compact);
      const to = this._presenterFor(entry, compact);
      if (from === to) {
        continue;
      }
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

  /** Idempotent removal — safe when the entry is already gone. */
  private _remove(entry: OpenInspection): void {
    if (!this._open().includes(entry)) {
      return;
    }
    this._open.update((entries) => entries.filter((e) => e !== entry));
    entry.inspection.destroy?.();
  }
}
