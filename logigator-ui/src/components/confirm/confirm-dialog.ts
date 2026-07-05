import { Component } from '@angular/core';
import { LgButton } from '../button/button';
import { LgDialog } from '../dialog/dialog';
import { Confirmation } from './confirmation';
import { LgConfirmOutlet } from './confirm-outlet';

/**
 * The keyless modal outlet for {@link ConfirmationService}. Shows the active
 * confirmation in an {@link LgDialog} (reused for chrome, focus trap and
 * scale-in) with reject/accept buttons built from the confirmation's
 * `*ButtonProps`. Escape or a backdrop click reject; the accept button runs the
 * `accept` callback. Handles only confirmations whose `key` matches its own
 * (both undefined for the bare keyless outlet).
 */
@Component({
  selector: 'lg-confirm-dialog',
  imports: [LgDialog, LgButton],
  template: `
    <lg-dialog
      [visible]="!!current()"
      [header]="current()?.header"
      [closable]="false"
      [dismissableMask]="true"
      [style]="{ width: '30rem' }"
      (visibleChange)="onVisibleChange($event)"
    >
      <p class="text-text">{{ current()?.message }}</p>
      <ng-template #footer>
        <lg-button
          [label]="current()?.rejectLabel"
          [severity]="rejectSeverity()"
          [outlined]="rejectOutlined()"
          (onClick)="reject()"
        />
        <lg-button
          [label]="current()?.acceptLabel"
          [severity]="acceptSeverity()"
          [outlined]="acceptOutlined()"
          (onClick)="accept()"
        />
      </ng-template>
    </lg-dialog>
  `
})
export class LgConfirmDialog extends LgConfirmOutlet {
  protected present(confirmation: Confirmation): void {
    this.current.set(confirmation);
  }

  // teardown() inherits the base no-op: the dialog's visibility derives from
  // `current()`, which the base clears on settle.

  /** Escape / backdrop dismissal from the dialog rejects. */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.reject();
    }
  }
}
