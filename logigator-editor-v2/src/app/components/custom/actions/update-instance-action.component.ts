import { Component, computed, inject, input } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponent } from '../custom-component';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';

/**
 * Renderer for {@link UpdateInstanceComponentAction}: a button shown only when
 * the selected instance's frozen snapshot is behind its master's current version,
 * which dispatches the undoable replace ({@link UpdateInstanceAction}) into the
 * active project. Self-contained — owns its own visibility and dispatch.
 */
@Component({
  selector: 'app-update-instance-action',
  imports: [LgButton],
  // `display: contents` so this action's host adds no flex-gap slot to the
  // settings form when hidden; the button aligns itself as a direct flex item.
  host: { class: 'contents' },
  template: `@if (updatable()) {
    <lg-button
      size="sm"
      severity="warn"
      label="Update to latest"
      class="self-end"
      (onClick)="update()"
    />
  }`
})
export class UpdateInstanceActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);

  protected readonly updatable = computed(() => {
    // Acts on a live instance, so it never surfaces on a palette/ghost selection.
    if (!this.context().component) return false;
    const def = this.registry.getDefinition(this.context().config.type);
    if (def?.id === undefined) return false;
    const masterTypeId = this.registry.masterTypeIdForId(def.id);
    const master =
      masterTypeId !== undefined
        ? this.registry.getDefinition(masterTypeId)
        : undefined;
    return (
      master?.version !== undefined &&
      def.version !== undefined &&
      master.version > def.version
    );
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
