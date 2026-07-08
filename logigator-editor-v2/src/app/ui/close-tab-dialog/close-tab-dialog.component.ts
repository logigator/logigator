import { Component, inject } from '@angular/core';
import { DialogConfig, DialogRef, LgButton, LgMessage } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';

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
  imports: [LgButton, LgMessage, TranslocoDirective],
  templateUrl: './close-tab-dialog.component.html'
})
export class CloseTabDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);

  private readonly data = this.config.data as CloseTabDialogData | undefined;

  protected readonly name = this.data?.name ?? '';
  protected readonly promotionWarning = this.data?.promotionWarning;

  protected save(): void {
    this.ref.close('save' satisfies CloseTabChoice);
  }

  protected discard(): void {
    this.ref.close('discard' satisfies CloseTabChoice);
  }

  protected cancel(): void {
    this.ref.close();
  }
}
