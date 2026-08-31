import { Component, computed, inject, input } from '@angular/core';
import { DialogService, LgButton } from '@logigator/ui';
import { DialogId } from '../../../analytics/analytics.mapping';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { EditComponentDetailsDialogComponent } from '../../../ui/dialogs/edit-component-details-dialog/edit-component-details-dialog.component';
import { resolveMasterSignal } from './resolve-master.signal';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Shown whenever the selection resolves to a library master, the entry that
 * owns the editable metadata. An orphaned instance has none, so it hides this
 * action and offers the edit action's degraded modes instead.
 */
@Component({
  selector: 'app-edit-details-action',
  imports: [LgButton, TranslateDirective],
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
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
      telemetryId: DialogId.ComponentDetails,
      data: { masterTypeId: resolved.masterTypeId }
    });
  }
}
