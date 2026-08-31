import { Component, computed, inject, input, signal } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { OutdatedInstancesService } from '../../../custom-component/outdated-instances.service';
import { ProjectService } from '../../../project/project.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Brings every instance of this type up to its master in one undo entry, shown
 * whenever the active project holds an outdated one. Config-scoped: the type
 * is what it acts on, so a palette selection carries it too.
 */
@Component({
  selector: 'app-update-all-instances-action',
  imports: [LgButton, TranslateDirective],
  // `display: contents` so a hidden host leaves no empty cell in the action
  // grid; the button is the grid item.
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

  /** Guards a second click while the master's circuit is fetched. */
  protected readonly busy = signal(false);

  protected readonly outdatedCount = computed(() =>
    this.outdatedInstances.countFor(this.context().config.type)
  );

  protected async updateAll(): Promise<void> {
    const project = this.projectService.activeProject();
    // The counts are scanned from the active project, so that is what the
    // batch acts on; a ghost context carries no project of its own.
    if (!project || this.busy()) return;

    const typeId = this.context().config.type;
    const masterTypeId = this.registry.resolveMaster(typeId)?.masterTypeId;
    if (masterTypeId === undefined) return;

    this.busy.set(true);
    try {
      // The master may be a summary-only cloud preload; load its circuit once
      // for the batch, or every replacement snapshots empty content.
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
