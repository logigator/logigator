import { Component } from '@angular/core';
import {
  LgButton,
  LgDialogContent,
  LgList,
  LgListItem,
  LgMessage
} from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { RelativeTimePipe } from '../../../utils/relative-time/relative-time.pipe';

/** One dirty cloud document the dialog offers to save. */
export interface LogoutDialogItem {
  name: string;
  /** Epoch-ms of its last local edit; absent if unknown (no subtitle shown). */
  lastEditedAt?: number;
}

export interface LogoutDialogData {
  /** The dirty cloud documents that would be affected. */
  items: LogoutDialogItem[];
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
  imports: [
    LgButton,
    LgList,
    LgListItem,
    LgMessage,
    TranslocoDirective,
    RelativeTimePipe
  ],
  templateUrl: './logout-dialog.component.html'
})
export class LogoutDialogComponent extends LgDialogContent<
  LogoutDialogData,
  LogoutChoice
> {
  protected readonly items = this.dialogData?.items ?? [];
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
