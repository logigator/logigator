import { Component, computed, inject, input } from '@angular/core';
import { DialogService, LgButton } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { EditComponentDetailsDialogComponent } from '../../../ui/dialogs/edit-component-details-dialog/edit-component-details-dialog.component';
import { resolveMasterSignal } from './resolve-master.signal';

/**
 * Renderer for {@link EditDetailsAction}: a button shown whenever the selected
 * instance (or placement ghost) resolves to a library master — the entry that
 * owns the editable metadata. Opens the
 * {@link EditComponentDetailsDialogComponent} for that master. An orphaned
 * instance has no master and hides this action (restore it first, via the edit
 * action's degraded modes).
 */
@Component({
  selector: 'app-edit-details-action',
  imports: [LgButton, TranslocoDirective],
  host: { class: 'contents' },
  template: `<ng-container *transloco="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        severity="secondary"
        [outlined]="true"
        icon="ph ph-pencil-simple"
        [label]="t('editComponentDetails.button')"
        class="w-full"
        (onClick)="edit()"
      />
    }
  </ng-container>`
})
export class EditDetailsActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);

  private readonly resolved = resolveMasterSignal(
    this.registry,
    () => this.context().config.type
  );

  protected readonly visible = computed(() => this.resolved() !== undefined);

  protected edit(): void {
    const resolved = this.resolved();
    if (!resolved) return;
    this.dialogService.open(EditComponentDetailsDialogComponent, {
      header: this.translation.translate('editComponentDetails.header'),
      width: '28rem',
      modal: true,
      closable: true,
      data: { masterTypeId: resolved.masterTypeId }
    });
  }
}
