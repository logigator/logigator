import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input
} from '@angular/core';
import { Button } from 'primeng/button';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';

/**
 * Renderer for {@link EditComponentAction}: a button that opens the master behind
 * the selected custom instance (resolved from the snapshot's `source.id`).
 * Self-contained — it injects what it needs rather than routing through the shell.
 */
@Component({
  selector: 'app-edit-component-action',
  imports: [Button],
  template: `<p-button
    size="small"
    label="Edit component"
    class="float-right"
    (onClick)="edit()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);

  protected edit(): void {
    const id = this.registry.idForTypeId(this.context().component.config.type);
    if (id !== undefined) this.customComponentService.openComponentForEdit(id);
  }
}
