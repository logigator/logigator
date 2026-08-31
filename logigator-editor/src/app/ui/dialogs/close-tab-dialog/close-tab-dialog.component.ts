import { Component } from '@angular/core';
import { LgButton, LgDialogContent, LgMessage } from '@logigator/ui';
import { TranslateDirective } from '../../../translation/translate.directive';

export interface CloseTabDialogData {
  name: string;
  /** Warning shown when saving would also publish local components. */
  promotionWarning?: string;
}

/** Dismissing the dialog means cancel. */
export type CloseTabChoice = 'save' | 'discard';

/**
 * Confirms closing a tab that has unsaved changes: Save, Discard, or Cancel.
 * Dismissing is the safe default and keeps the tab open, so a stray dismissal
 * never loses work. Collects the choice only. A warning that saving would also
 * publish local components folds in here rather than into a second dialog.
 */
@Component({
  selector: 'app-close-tab-dialog',
  imports: [LgButton, LgMessage, TranslateDirective],
  templateUrl: './close-tab-dialog.component.html'
})
export class CloseTabDialogComponent extends LgDialogContent<
  CloseTabDialogData,
  CloseTabChoice
> {
  protected readonly name = this.dialogData?.name ?? '';
  protected readonly promotionWarning = this.dialogData?.promotionWarning;

  protected save(): void {
    this.dialogRef.close('save');
  }

  protected discard(): void {
    this.dialogRef.close('discard');
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
