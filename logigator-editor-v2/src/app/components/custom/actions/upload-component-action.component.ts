import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';

/**
 * Renderer for {@link UploadComponentAction}: a button shown only when the
 * selected instance resolves to a **local** master, which uploads (moves) that
 * master to the user's cloud library. Disabled with a hint when signed out.
 * Self-contained — owns its own visibility, auth gating and dispatch.
 */
@Component({
  selector: 'app-upload-component-action',
  imports: [Button, Tooltip],
  template: `@if (visible()) {
    <p-button
      size="small"
      icon="ph ph-cloud-arrow-up"
      label="Upload to cloud"
      class="float-right"
      [disabled]="!authenticated()"
      [pTooltip]="authenticated() ? '' : 'Sign in to upload to the cloud'"
      tooltipPosition="top"
      (onClick)="upload()"
    />
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly userService = inject(UserService);

  private readonly resolved = computed(() => {
    this.registry.revision(); // recompute after a promotion flips the source
    return this.registry.resolveMaster(this.context().component.config.type);
  });

  protected readonly visible = computed(
    () => this.resolved()?.master.source === 'browser'
  );

  protected readonly authenticated = computed(
    () => this.userService.user() !== null
  );

  protected upload(): void {
    const masterTypeId = this.resolved()?.masterTypeId;
    if (masterTypeId !== undefined) {
      void this.customComponentService.uploadComponent(masterTypeId);
    }
  }
}
