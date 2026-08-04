import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgList,
  LgListItem,
  LgMessage,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { UserService } from '../../../user/user.service';
import { LocalUploadDependency } from '../../../persistence/promotion.service';
import { TranslateDirective } from '../../../translation/translate.directive';

export interface UploadDialogData {
  /** Wording variant; a stored project opens as `'project'`. */
  kind: 'project' | 'component' | 'draft';
  name: string;
  /** Local components the circuit embeds, children-before-parents. */
  dependencies: LocalUploadDependency[];
  /**
   * When set, visibility is already decided (a first server save chose it in the
   * save dialog): the toggle is hidden and this value is returned as-is.
   */
  presetIsPublic?: boolean;
}

export interface UploadDialogResult {
  isPublic: boolean;
}

/**
 * Confirms moving a local project or component to the cloud and collects its
 * visibility. A cloud document may only contain cloud components, so **every**
 * resolvable local component the circuit embeds is published alongside it — the
 * dialog lists them for transparency but there is no per-component opt-out (the
 * {@link UploadCoordinatorService} promotes them all). A component that no longer
 * resolves to a library master cannot be published and stays an embedded copy; an
 * inline warning calls that out. Collects input only — it closes with an
 * {@link UploadDialogResult} (or `undefined` when cancelled).
 */
@Component({
  selector: 'app-upload-dialog',
  imports: [
    FormsModule,
    LgToggleSwitch,
    LgTooltip,
    LgButton,
    LgList,
    LgListItem,
    LgMessage,
    TranslateDirective
  ],
  templateUrl: './upload-dialog.component.html'
})
export class UploadDialogComponent extends LgDialogContent<
  UploadDialogData,
  UploadDialogResult
> {
  protected readonly userService = inject(UserService);

  private readonly data = this.dialogData;

  protected readonly kind = this.data?.kind ?? 'project';
  protected readonly name = this.data?.name ?? '';
  protected readonly dependencies = this.data?.dependencies ?? [];

  /** Visibility already chosen upstream: hide the toggle and return it as-is. */
  protected readonly lockedIsPublic = this.data?.presetIsPublic;
  protected readonly visibilityLocked = this.lockedIsPublic !== undefined;

  /** Resolvable local components — these get published alongside the target. */
  protected readonly publishedDependencies = this.dependencies.filter(
    (d) => d.masterTypeId !== null
  );
  /** Embedded-only components that can no longer be published (master gone). */
  protected readonly unresolvableCount = this.dependencies.filter(
    (d) => d.masterTypeId === null
  ).length;

  protected readonly isPublic = signal(this.lockedIsPublic ?? true);

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected upload(): void {
    this.dialogRef.close({ isPublic: this.isPublic() });
  }
}
