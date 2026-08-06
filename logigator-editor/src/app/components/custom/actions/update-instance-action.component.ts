import { Component, computed, inject, input } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponent } from '../custom-component';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { OutdatedInstancesService } from '../../../custom-component/outdated-instances.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Renderer for {@link UpdateInstanceComponentAction}: a button shown only when
 * the selected instance's frozen snapshot is behind its master's current version,
 * which dispatches the undoable replace ({@link UpdateInstanceAction}) into the
 * active project. Self-contained — owns its own visibility and dispatch.
 */
@Component({
  selector: 'app-update-instance-action',
  imports: [LgButton, TranslateDirective],
  // `display: contents` so this action's host leaves no empty cell in the
  // settings panel's action grid when hidden; the button is the grid item.
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
    @if (updatable()) {
      <lg-button
        size="sm"
        severity="warn"
        [label]="t('componentActions.update')"
        class="w-full col-span-2"
        (onClick)="update()"
      />
    }
  </ng-container>`
})
export class UpdateInstanceActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly outdatedInstances = inject(OutdatedInstancesService);

  protected readonly updatable = computed(() => {
    // Reading the revision re-resolves the master after a save adopts its new
    // version stamp, so the button appears without reselecting the instance.
    this.registry.revision();
    // Acts on a live instance, so it never surfaces on a palette/ghost selection.
    if (!this.context().component) return false;
    return this.outdatedInstances.isOutdated(this.context().config.type);
  });

  protected async update(): Promise<void> {
    const { component, project } = this.context();
    // instanceOnly: only ever rendered with a live instance + project, but the
    // context types them nullable for the palette/ghost case.
    if (!project || !(component instanceof CustomComponent)) return;
    // The master may be a summary-only cloud preload; load its circuit first.
    const def = this.registry.getDefinition(component.config.type);
    const masterTypeId =
      def?.id !== undefined
        ? this.registry.masterTypeIdForId(def.id)
        : undefined;
    if (
      masterTypeId !== undefined &&
      !(await this.customComponentService.ensureMasterCircuit(masterTypeId))
    ) {
      // Cloud fetch failed (the service toasted) — leave the instance as-is.
      return;
    }
    const action = this.customComponentService.buildInstanceUpdate(component);
    if (action) project.actionManager.push(action);
  }
}
