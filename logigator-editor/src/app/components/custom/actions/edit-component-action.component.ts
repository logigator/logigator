import { Component, computed, inject, input } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Opens the master behind the selected custom instance. A resolving master is
 * a plain Edit button; an orphan — circuit still embedded, library entry gone
 * — degrades by where the host document came from:
 *
 * - inside a borrowed share, **View inside** opens the embedded circuit
 *   read-only: the master belongs to whoever published the share, and looking
 *   inside must not deposit a stranger's component in the viewer's library;
 * - in the viewer's own document, a lost local or unknown-origin master offers
 *   **Restore & edit**, which rebuilds it into the browser library;
 * - a lost cloud master while signed out offers **Sign in to edit**: it is
 *   probably just unloaded, so restoring locally would duplicate it.
 */
@Component({
  selector: 'app-edit-component-action',
  imports: [LgButton, LgTooltip, TranslateDirective],
  // `display: contents` so a hidden host leaves no empty cell in the settings
  // panel's action grid; the button is the grid item. The degraded modes are
  // the only action on an orphan, so they span both columns.
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
    @if (mode() === 'edit') {
      <button
        lgButton
        size="sm"
        icon="ph ph-circuitry"
        class="w-full"
        (onClick)="edit()"
      >
        {{ t('componentActions.edit') }}
      </button>
    } @else if (mode() === 'view') {
      <button
        lgButton
        size="sm"
        icon="ph ph-eye"
        class="w-full col-span-2"
        [lgTooltip]="t('componentActions.viewTooltip')"
        tooltipPosition="top"
        (onClick)="view()"
      >
        {{ t('componentActions.view') }}
      </button>
    } @else if (mode() === 'restore') {
      <button
        lgButton
        size="sm"
        icon="ph ph-arrow-counter-clockwise"
        class="w-full col-span-2"
        [lgTooltip]="t('componentActions.restoreTooltip')"
        tooltipPosition="top"
        (onClick)="restore()"
      >
        {{ t('componentActions.restore') }}
      </button>
    } @else if (mode() === 'signIn') {
      <button
        lgButton
        disabledInteractive
        size="sm"
        icon="ph ph-cloud-slash"
        class="w-full col-span-2"
        [disabled]="true"
        [lgTooltip]="t('componentActions.signInTooltip')"
        tooltipPosition="top"
      >
        {{ t('componentActions.signInToEdit') }}
      </button>
    }
  </ng-container>`
})
export class EditComponentActionComponent {
  public readonly context = input.required<ComponentActionContext>();

  private readonly registry = inject(CustomComponentRegistry);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly userService = inject(UserService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  private readonly type = computed(() => this.context().config.type);

  private readonly resolved = computed(() => {
    this.registry.revision(); // re-resolve after a restore/promotion
    return this.registry.resolveMaster(this.type());
  });

  /**
   * `edit` when the master resolves; `view` for an orphan inside a borrowed
   * share; `restore` for a lost local/unknown master; `signIn` for a lost cloud
   * master while signed out; `null` for a built-in.
   */
  protected readonly mode = computed<
    'edit' | 'view' | 'restore' | 'signIn' | null
  >(() => {
    const type = this.type();
    if (type < CUSTOM_TYPE_ID_BASE) return null;
    if (this.resolved()) return 'edit';
    // Orphan: circuit embedded, no library master resolves.
    const host = this.context().project;
    if (host && this.metadataStore.getMetadata(host)?.source === 'share') {
      return 'view';
    }
    const orphanOrigin = this.registry.getDefinition(type)?.source;
    if (orphanOrigin === 'server' && this.userService.user() === null) {
      return 'signIn';
    }
    return 'restore';
  });

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

  protected view(): void {
    this.customComponentService.viewSnapshot(this.type());
  }
}
