import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DialogConfig,
  DialogRef,
  LgButton,
  LgCheckbox,
  LgMessage,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { UserService } from '../../user/user.service';
import { LocalUploadDependency } from '../../persistence/persistence.service';

export interface UploadDialogData {
  /** Wording variant; a stored project opens as `'project'`. */
  kind: 'project' | 'component';
  name: string;
  /** Local components the circuit embeds, children-before-parents. */
  dependencies: LocalUploadDependency[];
}

export interface UploadDialogResult {
  isPublic: boolean;
  /**
   * The local dependencies the user chose to upload as their own cloud library
   * entries, preserving the children-before-parents input order so the
   * coordinator can upload them sequentially and let each parent reference its
   * already-promoted children.
   */
  dependencyMasterTypeIds: number[];
}

/**
 * Collects the options for moving a local project or component to the cloud:
 * visibility (public/private) and, when the circuit embeds local custom
 * components, which of them to upload as their own library entries (checkbox
 * list, all preselected). Excluding a dependency severs its cloud copy from the
 * local library entry — an inline warning spells that out. Collects input only —
 * it closes with an {@link UploadDialogResult} (or `undefined` when cancelled);
 * the {@link UploadCoordinatorService} performs the upload. Visibility defaults
 * to public, matching the create dialogs.
 */
@Component({
  selector: 'app-upload-dialog',
  imports: [
    FormsModule,
    LgCheckbox,
    LgToggleSwitch,
    LgTooltip,
    LgButton,
    LgMessage,
    TranslocoDirective
  ],
  templateUrl: './upload-dialog.component.html'
})
export class UploadDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);
  protected readonly userService = inject(UserService);

  private readonly data = this.config.data as UploadDialogData | undefined;

  protected readonly kind = this.data?.kind ?? 'project';
  protected readonly name = this.data?.name ?? '';
  protected readonly dependencies = this.data?.dependencies ?? [];

  /** The dependencies that still resolve to a browser master — uploadable. */
  protected readonly uploadableDependencies = this.dependencies.filter(
    (d): d is LocalUploadDependency & { masterTypeId: number } =>
      d.masterTypeId !== null
  );

  protected readonly isPublic = signal(true);
  protected readonly selected = signal<ReadonlySet<number>>(
    new Set(this.uploadableDependencies.map((d) => d.masterTypeId))
  );

  protected readonly allSelected = computed(
    () => this.selected().size === this.uploadableDependencies.length
  );
  /** Local components that will NOT get their own cloud entry (unchecked or unresolvable). */
  protected readonly excludedCount = computed(
    () => this.dependencies.length - this.selected().size
  );

  protected toggleDependency(masterTypeId: number, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(masterTypeId);
    } else {
      next.delete(masterTypeId);
    }
    this.selected.set(next);
  }

  protected toggleAll(): void {
    this.selected.set(
      this.allSelected()
        ? new Set()
        : new Set(this.uploadableDependencies.map((d) => d.masterTypeId))
    );
  }

  protected cancel(): void {
    this.ref.close();
  }

  protected upload(): void {
    this.ref.close({
      isPublic: this.isPublic(),
      dependencyMasterTypeIds: this.uploadableDependencies
        .filter((d) => this.selected().has(d.masterTypeId))
        .map((d) => d.masterTypeId)
    } satisfies UploadDialogResult);
  }
}
