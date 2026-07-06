import { Component, inject, input } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { ToastService } from '../../../logging/toast.service';

/**
 * Renderer for {@link EditComponentAction}: a button that opens the master behind
 * the selected custom instance (resolved from the snapshot's `source.id`).
 * Self-contained — it injects what it needs rather than routing through the shell.
 */
@Component({
  selector: 'app-edit-component-action',
  imports: [LgButton],
  template: `<lg-button
    size="sm"
    label="Edit component"
    class="float-right"
    (onClick)="edit()"
  />`
})
export class EditComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected edit(): void {
    const id = this.registry.idForTypeId(this.context().component.config.type);
    if (id === undefined) {
      this.toast.error(
        this.transloco.translate('componentActions.sourceUnavailable'),
        'EditComponentAction'
      );
      return;
    }
    this.customComponentService.openComponentForEdit(id);
  }
}
