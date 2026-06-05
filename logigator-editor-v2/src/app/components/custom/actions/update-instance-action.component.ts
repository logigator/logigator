import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { Button } from 'primeng/button';
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
  imports: [Button],
  template: `@if (updatable()) {
    <p-button
      size="small"
      severity="warn"
      label="Update to latest"
      class="float-right"
      (onClick)="update()"
    />
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateInstanceActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);

  protected readonly updatable = computed(() => {
    const def = this.registry.getDefinition(
      this.context().component.config.type
    );
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

  protected update(): void {
    const { component, project } = this.context();
    if (!(component instanceof CustomComponent)) return;
    const action = this.customComponentService.buildInstanceUpdate(component);
    if (action) project.actionManager.push(action);
  }
}
