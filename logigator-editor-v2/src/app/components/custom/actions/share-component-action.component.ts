import { Component, computed, inject, input } from '@angular/core';
import { DialogService, LgButton } from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import {
  ShareDialogComponent,
  ShareDialogData
} from '../../../ui/share-dialog/share-dialog.component';
import { resolveMasterSignal } from './resolve-master.signal';

/**
 * Renderer for {@link ShareComponentAction}: a button shown only when the selected
 * instance resolves to a **cloud** master, which opens the shared
 * {@link ShareDialogComponent} for that component's server id (share link + public
 * visibility). Local masters use the upload action instead; there is nothing to
 * share until a component lives in the cloud.
 */
@Component({
  selector: 'app-share-component-action',
  imports: [LgButton, TranslocoDirective],
  template: `<ng-container *transloco="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        severity="secondary"
        [outlined]="true"
        icon="ph ph-share-network"
        [label]="t('shareComponent.button')"
        class="float-right"
        (onClick)="share()"
      />
    }
  </ng-container>`
})
export class ShareComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly dialogService = inject(DialogService);
  private readonly transloco = inject(TranslocoService);

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
      header: this.transloco.translate('shareDialog.headerComponent'),
      width: '32rem',
      modal: true,
      closable: true,
      data: {
        kind: 'component',
        componentId: master.id,
        masterTypeId: resolved.masterTypeId,
        name: master.name,
        link: master.link ?? '',
        isPublic: master.isPublic ?? false
      } satisfies ShareDialogData
    });
  }
}
