import { Component, inject } from '@angular/core';
import { DialogConfig, DialogRef, LgButton, LgMessage } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';

export interface LogoutDialogData {
  /** Display names of the dirty cloud documents that would be affected. */
  names: string[];
  /**
   * When saving would also publish embedded local components to the cloud
   * library, the warning shown for it. Absent otherwise.
   */
  promotionWarning?: string;
}

/** What the user chose; dismissing the dialog (X / Escape) means cancel. */
export type LogoutChoice = 'save' | 'discard';

/**
 * Confirms logging out while cloud documents have unsaved changes: save them
 * first, log out without saving, or cancel. Dismissing (the ✕, Escape, or
 * backdrop) is the safe default — it cancels and keeps the session. Collects
 * the choice only; `SessionLifecycleService` performs the saves and the logout.
 */
@Component({
  selector: 'app-logout-dialog',
  imports: [LgButton, LgMessage, TranslocoDirective],
  templateUrl: './logout-dialog.component.html'
})
export class LogoutDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);

  private readonly data = this.config.data as LogoutDialogData | undefined;

  protected readonly names = this.data?.names ?? [];
  protected readonly promotionWarning = this.data?.promotionWarning;

  protected save(): void {
    this.ref.close('save' satisfies LogoutChoice);
  }

  protected discard(): void {
    this.ref.close('discard' satisfies LogoutChoice);
  }

  protected cancel(): void {
    this.ref.close();
  }
}
