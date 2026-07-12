import { Component, computed, inject, input } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import { CUSTOM_TYPE_ID_BASE } from '../../component-type.enum';

/**
 * Renderer for {@link EditComponentAction}. Opens the master behind the selected
 * custom instance. When that master can still be resolved (in either library) it
 * is a plain **Edit** button. When it cannot — an **orphan**, whose circuit is
 * still embedded in the document but whose library entry is gone — it degrades
 * gracefully instead of dead-ending:
 *
 * - a lost **local** master (or unknown origin) offers **Restore & edit**, which
 *   rebuilds it into the browser library and opens it;
 * - a lost **cloud** master while signed out offers **Sign in to edit** (it is
 *   probably just unloaded, so restoring locally would duplicate it).
 *
 * Self-contained — it injects what it needs rather than routing through the shell.
 */
@Component({
  selector: 'app-edit-component-action',
  imports: [LgButton, LgTooltip, TranslocoDirective],
  // `display: contents` so a hidden/empty action host adds no flex-gap slot to
  // the settings form; the button aligns itself as a direct flex item.
  host: { class: 'contents' },
  template: `<ng-container *transloco="let t">
    @if (mode() === 'edit') {
      <lg-button
        size="sm"
        [label]="t('componentActions.edit')"
        class="self-end"
        (onClick)="edit()"
      />
    } @else if (mode() === 'restore') {
      <lg-button
        size="sm"
        icon="ph ph-arrow-counter-clockwise"
        [label]="t('componentActions.restore')"
        class="self-end"
        [lgTooltip]="t('componentActions.restoreTooltip')"
        tooltipPosition="top"
        (onClick)="restore()"
      />
    } @else if (mode() === 'signIn') {
      <lg-button
        size="sm"
        icon="ph ph-cloud-slash"
        [label]="t('componentActions.signInToEdit')"
        class="self-end"
        [disabled]="true"
        [lgTooltip]="t('componentActions.signInTooltip')"
        tooltipPosition="top"
      />
    }
  </ng-container>`
})
export class EditComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly userService = inject(UserService);

  private readonly type = computed(() => this.context().config.type);

  private readonly resolved = computed(() => {
    this.registry.revision(); // re-resolve after a restore/promotion
    return this.registry.resolveMaster(this.type());
  });

  /**
   * `edit` when the master resolves; `restore` for a lost local/unknown master;
   * `signIn` for a lost cloud master while signed out; `null` for a built-in.
   */
  protected readonly mode = computed<'edit' | 'restore' | 'signIn' | null>(
    () => {
      const type = this.type();
      if (type < CUSTOM_TYPE_ID_BASE) return null;
      if (this.resolved()) return 'edit';
      // Orphan: its circuit is embedded but no library master resolves.
      const orphanOrigin = this.registry.getDefinition(type)?.source;
      if (orphanOrigin === 'server' && this.userService.user() === null) {
        return 'signIn';
      }
      return 'restore';
    }
  );

  protected edit(): void {
    const resolved = this.resolved();
    if (resolved) {
      void this.customComponentService.openComponentForEdit(
        resolved.master.id!
      );
    }
  }

  protected restore(): void {
    void this.customComponentService.restoreOrphanAndEdit(this.type());
  }
}
