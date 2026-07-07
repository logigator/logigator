import { Component, computed, inject, input } from '@angular/core';
import { DialogService, LgButton, LgTooltip } from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import {
  UploadComponentDialogComponent,
  UploadComponentDialogData,
  UploadComponentDialogResult
} from '../../../ui/upload-component-dialog/upload-component-dialog.component';

/**
 * Renderer for {@link UploadComponentAction}: a button shown only when the
 * selected instance resolves to a **local** master, which opens the upload-to-cloud
 * dialog for that master (visibility + optional dependency upload). Disabled with a
 * hint when signed out. Self-contained — owns its own visibility, auth gating and
 * dispatch.
 */
@Component({
  selector: 'app-upload-component-action',
  imports: [LgButton, LgTooltip, TranslocoDirective],
  template: `<ng-container *transloco="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        icon="ph ph-cloud-arrow-up"
        [label]="t('uploadComponent.button')"
        class="float-right"
        [disabled]="!authenticated()"
        [lgTooltip]="authenticated() ? '' : t('uploadComponent.signInTooltip')"
        tooltipPosition="top"
        (onClick)="upload()"
      />
    }
  </ng-container>`
})
export class UploadComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly userService = inject(UserService);
  private readonly dialogService = inject(DialogService);
  private readonly transloco = inject(TranslocoService);

  private readonly resolved = computed(() => {
    this.registry.revision(); // recompute after a promotion flips the source
    return this.registry.resolveMaster(this.context().config.type);
  });

  protected readonly visible = computed(
    () => this.resolved()?.master.source === 'browser'
  );

  protected readonly authenticated = computed(
    () => this.userService.user() !== null
  );

  protected upload(): void {
    const resolved = this.resolved();
    if (!resolved) return;
    const { masterTypeId, master } = resolved;

    const ref = this.dialogService.open<
      UploadComponentDialogComponent,
      UploadComponentDialogResult
    >(UploadComponentDialogComponent, {
      header: this.transloco.translate('uploadComponent.dialogHeader'),
      width: '28rem',
      modal: true,
      closable: true,
      data: {
        masterTypeId,
        name: master.name
      } satisfies UploadComponentDialogData
    });
    if (!ref) return;

    ref.onClose.subscribe((result?: UploadComponentDialogResult) => {
      if (!result) return;
      if (result.withDependencies) {
        void this.customComponentService.uploadComponentWithDependencies(
          masterTypeId,
          result.isPublic
        );
      } else {
        void this.customComponentService.uploadComponent(
          masterTypeId,
          result.isPublic
        );
      }
    });
  }
}
