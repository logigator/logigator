import { computed, Directive, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Confirmation } from './confirmation';
import { ConfirmationService } from './confirmation.service';

/**
 * Shared behaviour for the two {@link ConfirmationService} outlets: `key`
 * routing, the `current` confirmation, the button-prop mapping and the settle
 * flow. Subclasses supply only {@link present} and {@link teardown}.
 *
 * A selectorless abstract `@Directive` so subclasses inherit its `key`
 * `input()`; never used on its own.
 */
@Directive()
export abstract class LgConfirmOutlet {
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
          this.present(c);
        }
      });
  }

  /** Show `confirmation` (set `current`, open any overlay). */
  protected abstract present(confirmation: Confirmation): void;

  /** Tear down any visual state opened by {@link present}. */
  protected teardown(): void {
    // A no-op for an outlet deriving its visibility from `current()`.
  }

  protected accept(): void {
    this.settle()?.accept?.();
  }

  protected reject(): void {
    this.settle()?.reject?.();
  }

  /** Clear the active confirmation and return it so a callback can run. */
  private settle(): Confirmation | null {
    const confirmation = this.current();
    this.teardown();
    this.current.set(null);
    return confirmation;
  }
}
