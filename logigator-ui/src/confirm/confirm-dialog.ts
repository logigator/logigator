import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LgButton } from '../button/button';
import { LgDialog } from '../dialog/dialog';
import { Confirmation } from './confirmation';
import { ConfirmationService } from './confirmation.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class LgConfirmDialog {
  readonly key = input<string>();
  protected readonly current = signal<Confirmation | null>(null);

  protected readonly acceptSeverity = computed(
    () => this.current()?.acceptButtonProps?.severity
  );
  protected readonly acceptOutlined = computed(
    () => this.current()?.acceptButtonProps?.outlined ?? false
  );
  protected readonly rejectSeverity = computed(
    () => this.current()?.rejectButtonProps?.severity ?? 'secondary'
  );
  protected readonly rejectOutlined = computed(
    () => this.current()?.rejectButtonProps?.outlined ?? false
  );

  constructor() {
    inject(ConfirmationService)
      .requireConfirmation$.pipe(takeUntilDestroyed())
      .subscribe((c) => {
        if ((c.key ?? undefined) === (this.key() ?? undefined)) {
          this.current.set(c);
        }
      });
  }

  protected accept(): void {
    this.settle()?.accept?.();
  }

  protected reject(): void {
    this.settle()?.reject?.();
  }

  /** Escape / backdrop dismissal from the dialog rejects. */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.reject();
    }
  }

  private settle(): Confirmation | null {
    const confirmation = this.current();
    this.current.set(null);
    return confirmation;
  }
}
