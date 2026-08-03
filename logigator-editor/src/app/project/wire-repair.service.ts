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
import { ProjectMetadataStore } from '../persistence/project-metadata.store';

/**
 * Board-wide wire-invariant repair: audits I1–I3 (plus outright collinear
 * overlaps), rebuilds the broken spans via {@link computeWireRepair} and
 * reports what happened (toast summary, per-violation console log). Two entry
 * points, both user-initiated: {@link repairManually} backs the Edit-menu
 * command and registers the fix as one undoable history entry;
 * {@link offerRepairOnLoad} audits a freshly loaded document (older saves may
 * carry corruption from before integration covered every mutation path) and
 * offers that same repair through a toast. A load never repairs by itself.
 */
@Injectable({ providedIn: 'root' })
export class WireRepairService {
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  /**
   * Audits a freshly loaded document and, when it is broken, offers the repair
   * as a toast action rather than applying it: the fix stays user-initiated
   * and lands in history like the Edit-menu command, so it can be undone. The
   * audit itself is a pure read — a clean board leaves no trace.
   *
   * Skips read-only shares: a share cannot be saved or exported, so accepting
   * a repair there would leave the user holding a modified document with
   * nowhere to put it.
   */
  public offerRepairOnLoad(project: Project): void {
    if (this.metadataStore.getMetadata(project)?.source === 'share') return;

    const violations = auditWireInvariants(project);
    if (violations.length === 0) return;

    this.logViolations(violations, 'load');
    this.toast.warnWithAction(
      this.translation.translate('wireRepair.loadDetected', {
        count: violations.length
      }),
      'WireRepairService',
      {
        label: this.translation.translate('wireRepair.repairAction'),
        handler: () => {
          // The offer never times out, so it can outlive the document it was
          // raised for — loading another circuit destroys this one.
          if (project.destroyed) return;
          this.repairManually(project);
        }
      }
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
