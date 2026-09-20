import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgInputText,
  LgMessage,
  LgSelectButton,
  type LgDocumentVisibility
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { UserService } from '../../../user/user.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { VisibilityPickerComponent } from '../../visibility-picker/visibility-picker.component';

/** The pre-fill passed to the save dialog. */
export interface SaveProjectDialogData {
  name: string;
}

export interface SaveProjectDialogResult {
  name: string;
  destination: 'server' | 'local';
  visibility: LgDocumentVisibility;
}

/** Mirrors the contract's `documentNameSchema` limit. */
const NAME_MAX_LENGTH = 20;

/**
 * Prompts for the name and destination of a never-saved draft on its first
 * save. Collects input only; `SaveCoordinatorService` does the persisting.
 */
@Component({
  selector: 'app-save-project-dialog',
  imports: [
    FormsModule,
    LgInputText,
    LgSelectButton,
    LgButton,
    TranslateDirective,
    LgMessage,
    VisibilityPickerComponent
  ],
  templateUrl: './save-project-dialog.component.html'
})
export class SaveProjectDialogComponent extends LgDialogContent<
  SaveProjectDialogData,
  SaveProjectDialogResult
> {
  private readonly translation = inject(TranslationService);
  protected readonly userService = inject(UserService);

  protected readonly destinationOptions = [
    {
      label: this.translation.translate('saveProjectDialog.destinationLocal'),
      value: 'local' as const
    },
    {
      label: this.translation.translate('saveProjectDialog.destinationCloud'),
      value: 'server' as const
    }
  ];

  protected readonly name = signal<string>(this.dialogData?.name ?? '');
  /** Cloud when signed in; local is the only saveable option otherwise. */
  protected readonly destination = signal<'server' | 'local'>(
    this.userService.user() ? 'server' : 'local'
  );
  /** Creating keeps publishing, which is what this dialog is for. */
  protected readonly visibility = signal<LgDocumentVisibility>('public');
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected get canSave(): boolean {
    if (this.name().trim().length === 0) return false;
    if (this.destination() === 'server' && !this.userService.user())
      return false;
    return true;
  }

  protected save(): void {
    if (!this.canSave) return;
    this.dialogRef.close({
      name: this.name().trim(),
      destination: this.destination(),
      visibility: this.visibility()
    });
  }
}
