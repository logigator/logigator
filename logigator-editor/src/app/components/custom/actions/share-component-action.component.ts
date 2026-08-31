import { Component, computed, inject, input } from '@angular/core';
import { DialogService, LgButton } from '@logigator/ui';
import { DialogId } from '../../../analytics/analytics.mapping';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { ShareDialogComponent } from '../../../ui/dialogs/share-dialog/share-dialog.component';
import { resolveMasterSignal } from './resolve-master.signal';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Shown only when the selection resolves to a cloud master: there is nothing
 * to share until a component lives in the cloud, and a local master offers the
 * upload action instead.
 */
@Component({
  selector: 'app-share-component-action',
  imports: [LgButton, TranslateDirective],
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        severity="secondary"
        [outlined]="true"
        icon="ph ph-share-network"
        [label]="t('shareComponent.button')"
        class="w-full"
        (onClick)="share()"
      />
    }
  </ng-container>`
})
export class ShareComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);

  private readonly resolved = resolveMasterSignal(
    this.registry,
    () => this.context().config.type
  );

  protected readonly visible = computed(
    () => this.resolved()?.master.source === 'server'
  );

  protected share(): void {
    const resolved = this.resolved();
    if (!resolved) return;
    const master = resolved.master;
    if (!master.id) return;
    this.dialogService.open(ShareDialogComponent, {
      header: this.translation.translate('shareDialog.headerComponent'),
      width: '32rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.ShareComponent,
      data: {
        kind: 'component',
        componentId: master.id,
        masterTypeId: resolved.masterTypeId,
        name: master.name,
        link: master.link ?? '',
        isPublic: master.isPublic ?? false
      }
    });
  }
}
