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
   * When set, visibility is already decided upstream: the toggle is hidden and
   * this value is returned as-is.
   */
  presetIsPublic?: boolean;
}

export interface UploadDialogResult {
  isPublic: boolean;
}

/**
 * Confirms moving a local project or component to the cloud and collects its
 * visibility. A cloud document may only contain cloud components, so **every**
 * resolvable local component the circuit embeds is published alongside it; the
 * list is for transparency, there is no per-component opt-out. One that no
 * longer resolves to a library master cannot be published and stays an embedded
 * copy, which an inline warning calls out. Collects input only.
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

  /** Visibility chosen upstream: hide the toggle and return it as-is. */
  protected readonly lockedIsPublic = this.data?.presetIsPublic;
  protected readonly visibilityLocked = this.lockedIsPublic !== undefined;

  /** Published alongside the target. */
  protected readonly publishedDependencies = this.dependencies.filter(
    (d) => d.masterTypeId !== null
  );
  /** Components whose master is gone, so they can no longer be published. */
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
