import { inject, Injectable } from '@angular/core';
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

/**
 * Board-wide wire-invariant repair: audits I1–I3 (plus outright collinear
 * overlaps), rebuilds the broken spans via {@link computeWireRepair} and
 * reports what happened (toast summary, per-violation console log). Two
 * entry points: {@link repairManually} backs the Edit-menu command and
 * registers the fix as one undoable history entry; {@link repairOnLoad}
 * silently heals a freshly loaded document (older saves may carry corruption
 * from before integration covered every mutation path) — currently not
 * called anywhere, deliberately: repairing on load is on hold.
 */
@Injectable({ providedIn: 'root' })
export class WireRepairService {
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  /**
   * Repairs a just-loaded project in place. Meant to run before the document
   * reaches an editor tab: no history exists yet, so the fix is applied
   * directly and deliberately NOT registered as an undo entry. Silent when
   * the board is clean; toasts a warning when something had to be repaired.
   * Not wired into the load paths right now — repair-on-load is on hold, so
   * only the Edit-menu command ({@link repairManually}) runs repairs.
   */
  public repairOnLoad(project: Project): void {
    const violations = auditWireInvariants(project);
    if (violations.length === 0) return;

    this.logViolations(violations, 'load');
    const plan = computeWireRepair(project);
    this.materialize(project, plan);
    this.verify(project);
    this.toast.warn(
      this.translation.translate('wireRepair.loadRepaired', {
        count: violations.length
      }),
      'WireRepairService'
    );
  }

  /**
   * The Edit-menu command: audits, repairs, registers the change as a single
   * undoable history entry and always toasts the outcome — including the
   * nothing-to-repair case.
   */
  public repairManually(project: Project): void {
    if (project.actionManager.locked) {
      this.logging.debug(
        'repair skipped: a drag session holds the project locked',
        'WireRepairService'
      );
      return;
    }
    // Clearing first retracts a live scissor cut — its seam is a deliberate,
    // transient I3 violation that must not be fused behind the cut's back.
    project.selectionManager.clear();

    const violations = auditWireInvariants(project);
    if (violations.length === 0) {
      this.logging.info('no wire invariant violations', 'WireRepairService');
      this.toast.success(
        this.translation.translate('wireRepair.clean'),
        'WireRepairService'
      );
      return;
    }

    this.logViolations(violations, 'manual');
    const plan = computeWireRepair(project);
    if (plan.removeWires.length === 0 && plan.addWires.length === 0) {
      // The audit flagged something the rebuild reproduced identically — a
      // checker/rebuild disagreement worth failing loudly over.
      this.logging.error(
        `audit found ${violations.length} violation(s) but the rebuild produced no diff`,
        'WireRepairService'
      );
      this.toast.success(
        this.translation.translate('wireRepair.clean'),
        'WireRepairService'
      );
      return;
    }

    // The actions serialize state in their constructors — build them before
    // materializing, then register against the already-applied state.
    const action = new ActionContainer();
    if (plan.removeWires.length > 0) {
      action.add(new RemoveWiresAction(...plan.removeWires));
    }
    if (plan.addWires.length > 0) {
      action.add(new AddWiresAction(...plan.addWires));
    }
    this.materialize(project, plan);
    project.actionManager.register(action);
    this.verify(project);
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

  /** Post-repair audit — anything left indicates a repair bug. */
  private verify(project: Project): void {
    const remaining = auditWireInvariants(project);
    if (remaining.length > 0) {
      const lines = remaining.map((v) => `  - [${v.kind}] ${v.detail}`);
      this.logging.error(
        `${remaining.length} violation(s) survived the repair:\n${lines.join('\n')}`,
        'WireRepairService'
      );
    }
  }
}
