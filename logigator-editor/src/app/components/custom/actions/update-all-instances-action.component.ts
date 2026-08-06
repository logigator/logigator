import { Component, computed, inject, input, signal } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { OutdatedInstancesService } from '../../../custom-component/outdated-instances.service';
import { ProjectService } from '../../../project/project.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Renderer for {@link UpdateAllInstancesComponentAction}: a button shown whenever
 * the active project holds at least one instance of this type that is behind its
 * master, which brings **all** of them up to date in one undo entry.
 *
 * Config-scoped, so it surfaces on a selected instance *and* on a palette
 * selection — the type is what it acts on, not the selection. It stays visible
 * when the selected instance is the only outdated one; the count in the label
 * says how many instances the click covers.
 */
@Component({
  selector: 'app-update-all-instances-action',
  imports: [LgButton, TranslateDirective],
  // `display: contents` so this action's host leaves no empty cell in the
  // settings panel's action grid when hidden; the button is the grid item.
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
    @if (outdatedCount(); as count) {
      <lg-button
        size="sm"
        severity="warn"
        outlined
        [label]="t('componentActions.updateAll', { count })"
        [loading]="busy()"
        class="w-full col-span-2"
        (onClick)="updateAll()"
      />
    }
  </ng-container>`
})
export class UpdateAllInstancesActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly outdatedInstances = inject(OutdatedInstancesService);
  private readonly projectService = inject(ProjectService);

  /** Guards against a second click while the master's circuit is being fetched. */
  protected readonly busy = signal(false);

  protected readonly outdatedCount = computed(() =>
    this.outdatedInstances.countFor(this.context().config.type)
  );

  protected async updateAll(): Promise<void> {
    const project = this.projectService.activeProject();
    // The counts are scanned from the active project, so that is what the batch
    // acts on — the ghost context carries no project of its own.
    if (!project || this.busy()) return;

    const typeId = this.context().config.type;
    const masterTypeId = this.registry.resolveMaster(typeId)?.masterTypeId;
    if (masterTypeId === undefined) return;

    this.busy.set(true);
    try {
      // The master may be a summary-only cloud preload; load its circuit once for
      // the whole batch, or every replacement would snapshot empty content.
      if (
        !(await this.customComponentService.ensureMasterCircuit(masterTypeId))
      )
        return;

      const instances = this.outdatedInstances.collectFor(masterTypeId);
      const action =
        this.customComponentService.buildInstancesUpdate(instances);
      if (action) project.actionManager.push(action);
    } finally {
      this.busy.set(false);
    }
  }
}
