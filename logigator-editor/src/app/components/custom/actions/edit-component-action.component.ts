import { Component, computed, inject, input } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { CUSTOM_TYPE_ID_BASE } from '../../component-type.enum';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Renderer for {@link EditComponentAction}. Opens the master behind the selected
 * custom instance. When that master can still be resolved (in either library) it
 * is a plain **Edit** button. When it cannot — an **orphan**, whose circuit is
 * still embedded in the document but whose library entry is gone — it degrades
 * gracefully instead of dead-ending, and which degraded mode applies turns on
 * whether the host document is the viewer's own or a borrowed **share**:
 *
 * - inside a share, **View inside** opens the embedded circuit read-only. The
 *   master belongs to whoever published the share, so no library recovery is
 *   meaningful — and looking inside a borrowed document must not deposit a
 *   stranger's component in the viewer's library. Keeping a copy is the share's
 *   own affordance (clone it), not this button's;
 * - in the viewer's own document, a lost **local** master (or unknown origin)
 *   offers **Restore & edit**, which rebuilds it into the browser library;
 * - in the viewer's own document, a lost **cloud** master while signed out
 *   offers **Sign in to edit** (it is probably just unloaded, so restoring
 *   locally would duplicate it).
 *
 * Self-contained — it injects what it needs rather than routing through the shell.
 */
@Component({
  selector: 'app-edit-component-action',
  imports: [LgButton, LgTooltip, TranslateDirective],
  // `display: contents` so a hidden/empty action host leaves no empty cell in
  // the settings panel's action grid; the button is the grid item. The degraded
  // modes are the only action on an orphan, so they span both columns.
  host: { class: 'contents' },
  template: `<ng-container *appTranslate="let t">
    @if (mode() === 'edit') {
      <lg-button
        size="sm"
        [label]="t('componentActions.edit')"
        icon="ph ph-circuitry"
        class="w-full"
        (onClick)="edit()"
      />
    } @else if (mode() === 'view') {
      <lg-button
        size="sm"
        icon="ph ph-eye"
        [label]="t('componentActions.view')"
        class="w-full col-span-2"
        [lgTooltip]="t('componentActions.viewTooltip')"
        tooltipPosition="top"
        (onClick)="view()"
      />
    } @else if (mode() === 'restore') {
      <lg-button
        size="sm"
        icon="ph ph-arrow-counter-clockwise"
        [label]="t('componentActions.restore')"
        class="w-full col-span-2"
        [lgTooltip]="t('componentActions.restoreTooltip')"
        tooltipPosition="top"
        (onClick)="restore()"
      />
    } @else if (mode() === 'signIn') {
      <lg-button
        size="sm"
        icon="ph ph-cloud-slash"
        [label]="t('componentActions.signInToEdit')"
        class="w-full col-span-2"
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
    // Orphan: its circuit is embedded but no library master resolves.
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
