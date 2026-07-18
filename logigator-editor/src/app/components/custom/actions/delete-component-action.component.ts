import { Component, computed, inject, input } from '@angular/core';
import { ConfirmationService, LgButton } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { resolveMasterSignal } from './resolve-master.signal';

/**
 * Renderer for {@link DeleteComponentAction}: a danger button shown whenever the
 * selected instance (or placement ghost) resolves to a library master — the only
 * time there is a library entry to remove. It opens an anchored confirm popover
 * (the delete is permanent, and for a cloud master also unpublishes it and kills
 * its share link) and, on accept, hands the master to
 * {@link CustomComponentService.deleteComponent}. Placed instances survive as
 * embedded copies; an orphaned instance has no master and hides this action.
 */
@Component({
  selector: 'app-delete-component-action',
  imports: [LgButton, TranslocoDirective],
  host: { class: 'contents' },
  template: `<ng-container *transloco="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        severity="danger"
        [outlined]="true"
        icon="ph ph-trash"
        [label]="t('deleteComponent.button')"
        class="self-end"
        (onClick)="confirmDelete($event)"
      />
    }
  </ng-container>`
})
export class DeleteComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponents = inject(CustomComponentService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);

  private readonly resolved = resolveMasterSignal(
    this.registry,
    () => this.context().config.type
  );

  protected readonly visible = computed(() => this.resolved() !== undefined);

  protected confirmDelete(event: Event): void {
    const resolved = this.resolved();
    if (!resolved) return;
    const master = resolved.master;
    this.confirmationService.confirm({
      key: 'inline',
      target: event.currentTarget as HTMLElement,
      message: this.translation.translate(
        master.source === 'server'
          ? 'deleteComponent.confirmMessageCloud'
          : 'deleteComponent.confirmMessageLocal',
        { name: master.name }
      ),
      acceptButtonProps: { severity: 'danger' },
      acceptLabel: this.translation.translate('deleteComponent.confirmAccept'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      rejectLabel: this.translation.translate('deleteComponent.confirmReject'),
      accept: () =>
        void this.customComponents.deleteComponent(resolved.masterTypeId)
    });
  }
}
