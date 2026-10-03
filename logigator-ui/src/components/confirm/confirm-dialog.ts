import { Component } from '@angular/core';
import { LgButton } from '../button/button';
import { LgDialog } from '../dialog/dialog';
import { Confirmation } from './confirmation';
import { LgConfirmOutlet } from './confirm-outlet';

/**
 * The modal outlet for {@link ConfirmationService}: the active confirmation in
 * an {@link LgDialog}, with buttons built from its `*ButtonProps`. Escape and
 * a backdrop click reject. It handles only confirmations whose `key` matches
 * its own, both being undefined for the bare keyless outlet.
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
        <button
          lgButton
          [severity]="rejectSeverity()"
          [outlined]="rejectOutlined()"
          (onClick)="reject()"
        >
          {{ current()?.rejectLabel }}
        </button>
        <button
          lgButton
          [severity]="acceptSeverity()"
          [outlined]="acceptOutlined()"
          (onClick)="accept()"
        >
          {{ current()?.acceptLabel }}
        </button>
      </ng-template>
    </lg-dialog>
  `
})
export class LgConfirmDialog extends LgConfirmOutlet {
  protected present(confirmation: Confirmation): void {
    this.current.set(confirmation);
  }

  /** Escape / backdrop dismissal from the dialog rejects. */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.reject();
    }
  }
}
