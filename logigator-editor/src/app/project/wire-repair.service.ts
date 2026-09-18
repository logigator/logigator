import { inject, Injectable, Injector } from '@angular/core';
import { Project } from './project';
import {
  auditWireInvariants,
  computeWireRepair,
  WireRepairPlan,
  WireViolation
} from './wire-repair';
import { ActionContainer } from '../actions/action-container';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';
import { TranslationService } from '../translation/translation.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { SimulationService } from '../simulation/simulation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';

/** Where a repair run came from; `load-offer` is an accepted on-load offer. */
export type WireRepairTrigger = 'menu' | 'load-offer';

/**
 * Board-wide wire-invariant repair: audits I1–I3 plus outright collinear
 * overlaps, rebuilds the broken spans and reports the outcome. Both entry
 * points are user-initiated — {@link repairManually} backs the Edit-menu
 * command and registers one undoable entry, {@link offerRepairOnLoad} audits a
 * freshly loaded document and offers that same repair through a toast. A load
 * never repairs by itself.
 */
@Injectable({ providedIn: 'root' })
export class WireRepairService {
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly analytics = inject(AnalyticsService);
  private readonly workModeService = inject(WorkModeService);
  private readonly injector = inject(Injector);

  /**
   * Offers the repair as a toast action rather than applying it, so the fix
   * stays user-initiated and undoable. The audit is a pure read, and a clean
   * board leaves no trace.
   *
   * Skips read-only shares: accepting there would leave the user holding a
   * modified document with nowhere to put it.
   */
  public offerRepairOnLoad(project: Project): void {
    if (this.metadataStore.getMetadata(project)?.source === 'share') return;

    const violations = auditWireInvariants(project);
    if (violations.length === 0) return;

    this.logViolations(violations, 'load');
    this.analytics.capture(AnalyticsEvent.WireRepairOffered, {
      violations: violations.length,
      kinds: distinctKinds(violations)
    });
    this.toast.warnWithAction(
      this.translation.translate('wireRepair.loadDetected', {
        count: violations.length
      }),
      'WireRepairService',
      {
        label: this.translation.translate('wireRepair.repairAction'),
        handler: () => {
          // The offer never times out, so it can outlive its document.
          if (project.destroyed) return;
          this.repairManually(project, 'load-offer');
        }
      }
    );
  }

  /**
   * Audits, repairs, registers the change as one undoable entry and always
   * toasts the outcome, the nothing-to-repair case included. A live simulation
   * session is left first, once the plan is known to change something.
   */
  public repairManually(
    project: Project,
    trigger: WireRepairTrigger = 'menu'
  ): void {
    if (project.actionManager.locked) {
      this.logging.debug(
        'repair skipped: a drag session holds the project locked',
        'WireRepairService'
      );
      this.captureRun(trigger, 'locked');
      return;
    }
    // Clearing retracts a live scissor cut, whose seam is a deliberate,
    // transient I3 violation that must not be fused behind the cut's back.
    project.selectionManager.clear();

    const violations = auditWireInvariants(project);
    if (violations.length === 0) {
      this.logging.info('no wire invariant violations', 'WireRepairService');
      this.captureRun(trigger, 'clean');
      this.toast.success(
        this.translation.translate('wireRepair.clean'),
        'WireRepairService'
      );
      return;
    }

    this.logViolations(violations, 'manual');
    const plan = computeWireRepair(project);
    if (plan.removeWires.length === 0 && plan.addWires.length === 0) {
      // The audit flagged what the rebuild reproduced identically: a
      // checker/rebuild disagreement worth failing loudly over.
      this.logging.error(
        `audit found ${violations.length} violation(s) but the rebuild produced no diff`,
        'WireRepairService'
      );
      this.captureRun(trigger, 'no-diff', {
        violations: violations.length,
        kinds: distinctKinds(violations)
      });
      this.toast.success(
        this.translation.translate('wireRepair.clean'),
        'WireRepairService'
      );
      return;
    }

    // The plan destroys the wires it replaces, and a live session's link →
    // render mapping addresses those instances: a session left up writes
    // powered state onto freed objects on its way out, over a compiled board
    // that no longer describes the circuit. The offer toast never
    // auto-dismisses, so it is clickable from inside a session that started
    // after it was raised.
    const leftSimulation = this.workModeService.mode() === WorkMode.SIMULATION;
    if (leftSimulation) {
      // Resolved here rather than injected: SimulationService reaches back to
      // this service through the shortcut and save chain.
      this.injector.get(SimulationService).exit();
      this.toast.info(
        this.translation.translate('wireRepair.leftSimulation'),
        'WireRepairService'
      );
    }

    // The actions serialize in their constructors, so build them before
    // materializing and register against the applied state.
    const action = new ActionContainer();
    if (plan.removeWires.length > 0) {
      action.add(new RemoveWiresAction(...plan.removeWires));
    }
    if (plan.addWires.length > 0) {
      action.add(new AddWiresAction(...plan.addWires));
    }
    this.materialize(project, plan);
    project.actionManager.register(action);
    this.captureRun(trigger, 'repaired', {
      violations: violations.length,
      kinds: distinctKinds(violations),
      removedWires: plan.removeWires.length,
      addedWires: plan.addWires.length,
      leftSimulation,
      // Non-zero means a repair bug: the audit still fails on its own output.
      survivingViolations: this.verify(project)
    });
    this.toast.success(
      this.translation.translate('wireRepair.repaired', {
        count: violations.length
      }),
      'WireRepairService'
    );
  }

  private materialize(project: Project, plan: WireRepairPlan): void {
    for (const w of plan.removeWires) project.removeWire(w.id);
    for (const w of plan.addWires) project.addWire(w);
    this.logging.info(
      `repair replaced ${plan.removeWires.length} wire(s) with ${plan.addWires.length}`,
      'WireRepairService'
    );
  }

  private logViolations(
    violations: WireViolation[],
    source: 'load' | 'manual'
  ): void {
    const lines = violations.map((v) => `  - [${v.kind}] ${v.detail}`);
    this.logging.warn(
      `found ${violations.length} wire invariant violation(s) (${source}):\n${lines.join('\n')}`,
      'WireRepairService'
    );
  }

  /** Post-repair audit; anything surviving indicates a repair bug. */
  private verify(project: Project): number {
    const remaining = auditWireInvariants(project);
    if (remaining.length > 0) {
      const lines = remaining.map((v) => `  - [${v.kind}] ${v.detail}`);
      this.logging.error(
        `${remaining.length} violation(s) survived the repair:\n${lines.join('\n')}`,
        'WireRepairService'
      );
    }
    return remaining.length;
  }

  private captureRun(
    trigger: WireRepairTrigger,
    outcome: 'clean' | 'repaired' | 'no-diff' | 'locked',
    properties: Record<string, unknown> = {}
  ): void {
    this.analytics.capture(AnalyticsEvent.WireRepairRun, {
      trigger,
      outcome,
      ...properties
    });
  }
}

/** The kinds present; violation details name elements and are never sent. */
function distinctKinds(violations: WireViolation[]): string[] {
  return [...new Set(violations.map((v) => v.kind))].sort();
}
