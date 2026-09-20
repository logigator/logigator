import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgList,
  LgListItem,
  LgMessage,
  type LgDocumentVisibility
} from '@logigator/ui';
import { UserService } from '../../../user/user.service';
import { LocalUploadDependency } from '../../../persistence/promotion.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { VisibilityPickerComponent } from '../../visibility-picker/visibility-picker.component';

export interface UploadDialogData {
  /** Wording variant; a stored project opens as `'project'`. */
  kind: 'project' | 'component' | 'draft';
  name: string;
  /** Local components the circuit embeds, children-before-parents. */
  dependencies: LocalUploadDependency[];
  /**
   * When set, visibility is already decided upstream: the picker is hidden and
   * this value is returned as-is.
   */
  presetVisibility?: LgDocumentVisibility;
}

export interface UploadDialogResult {
  visibility: LgDocumentVisibility;
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
    LgButton,
    LgList,
    LgListItem,
    LgMessage,
    TranslateDirective,
    VisibilityPickerComponent
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

  /** Visibility chosen upstream: hide the picker and return it as-is. */
  private readonly lockedVisibility = this.data?.presetVisibility;
  protected readonly visibilityLocked = this.lockedVisibility !== undefined;

  /** Published alongside the target. */
  protected readonly publishedDependencies = this.dependencies.filter(
    (d) => d.masterTypeId !== null
  );
  /** Components whose master is gone, so they can no longer be published. */
  protected readonly unresolvableCount = this.dependencies.filter(
    (d) => d.masterTypeId === null
  ).length;

  /** Creating keeps publishing, which is what this dialog is for. */
  protected readonly visibility = signal<LgDocumentVisibility>(
    this.lockedVisibility ?? 'public'
  );

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected upload(): void {
    this.dialogRef.close({ visibility: this.visibility() });
  }
}
