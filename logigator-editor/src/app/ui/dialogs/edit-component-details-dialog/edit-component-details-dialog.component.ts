import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgInputText,
  LgMarkdownField,
  LgTextarea
} from '@logigator/ui';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { normalizeAuthoredText } from '@logigator/core';

export interface EditComponentDetailsDialogData {
  /** The library master whose details are edited. */
  masterTypeId: number;
}

/**
 * Edits a library master's name, symbol and description after creation, under
 * the same limits as the new-component dialog. Placed instances are frozen
 * snapshots and keep their old details until explicitly updated.
 */
/** Mirrors the contract's `documentDescriptionSchema` limit. */
const DESCRIPTION_MAX_LENGTH = 2048;

@Component({
  selector: 'app-edit-component-details-dialog',
  imports: [
    FormsModule,
    LgInputText,
    LgButton,
    TranslateDirective,
    LgMarkdownField,
    LgTextarea
  ],
  templateUrl: './edit-component-details-dialog.component.html'
})
export class EditComponentDetailsDialogComponent extends LgDialogContent<EditComponentDetailsDialogData> {
  private readonly customComponentService = inject(CustomComponentService);
  private readonly registry = inject(CustomComponentRegistry);

  private readonly master = this.dialogData
    ? this.registry.getDefinition(this.dialogData.masterTypeId)
    : undefined;

  protected readonly name = signal(this.master?.name ?? '');
  protected readonly symbol = signal(this.master?.symbol ?? '');
  protected readonly description = signal(this.master?.description ?? '');

  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;

  protected get canSave(): boolean {
    return (
      this.name().trim().length > 0 &&
      this.symbol().trim().length > 0 &&
      this.description().length <= DESCRIPTION_MAX_LENGTH
    );
  }

  protected save(): void {
    if (!this.canSave || !this.dialogData) return;
    // Fire-and-forget: the dialog closes optimistically and a failed persist
    // surfaces through the service's toast.
    void this.customComponentService.updateComponentDetails(
      this.dialogData.masterTypeId,
      {
        name: this.name().trim(),
        symbol: this.symbol().trim(),
        // Normalized here rather than only in the contract: an edit to a
        // browser-stored component never passes through it.
        description: normalizeAuthoredText(this.description())
      }
    );
    this.dialogRef.close();
  }
}
