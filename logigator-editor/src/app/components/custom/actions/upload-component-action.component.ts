import { Component, computed, inject, input } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { UserService } from '../../../user/user.service';
import { UploadCoordinatorService } from '../../../ui/upload/upload-coordinator.service';
import { resolveMasterSignal } from './resolve-master.signal';

/**
 * Renderer for {@link UploadComponentAction}: a button shown only when the
 * selected instance resolves to a **local** master, which hands that master to
 * the shared {@link UploadCoordinatorService} (dependency analysis + dialog +
 * upload). Disabled with a hint when signed out.
 */
@Component({
  selector: 'app-upload-component-action',
  imports: [LgButton, LgTooltip, TranslocoDirective],
  host: { class: 'contents' },
  template: `<ng-container *transloco="let t">
    @if (visible()) {
      <lg-button
        size="sm"
        icon="ph ph-cloud-arrow-up"
        [label]="t('uploadComponent.button')"
        class="self-end"
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
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly userService = inject(UserService);

  private readonly resolved = resolveMasterSignal(
    this.registry,
    () => this.context().config.type
  );

  protected readonly visible = computed(
    () => this.resolved()?.master.source === 'browser'
  );

  protected readonly authenticated = computed(
    () => this.userService.user() !== null
  );

  protected upload(): void {
    const resolved = this.resolved();
    if (!resolved) return;
    void this.uploadCoordinator.requestUpload({
      kind: 'component',
      masterTypeId: resolved.masterTypeId
    });
  }
}
