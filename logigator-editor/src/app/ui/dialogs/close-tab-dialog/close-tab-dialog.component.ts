import { Component } from '@angular/core';
import { LgButton, LgDialogContent, LgMessage } from '@logigator/ui';
import { TranslateDirective } from '../../../translation/translate.directive';

export interface CloseTabDialogData {
  name: string;
  /**
   * When the tab is a cloud document with local components, the warning shown
   * because saving will publish them to the cloud library. Absent otherwise.
   */
  promotionWarning?: string;
}

/** What the user chose; dismissing the dialog (X / Escape) means cancel. */
export type CloseTabChoice = 'save' | 'discard';

/**
 * Confirms closing a tab that has unsaved changes: Save, Discard, or Cancel.
 * Dismissing (the ✕, Escape, or backdrop) is the safe default — it cancels and
 * keeps the tab open, so a stray dismissal never loses work. Collects the choice
 * only; the caller performs the save/dispose. When saving would also publish
 * local components to the cloud (a cloud document with local deps), that warning
 * is folded in here rather than shown as a second dialog.
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
