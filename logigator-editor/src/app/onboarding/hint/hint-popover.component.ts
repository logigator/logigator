import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgButton, LgCaret, type LgOverlaySide } from '@logigator/ui';

/**
 * Presentational just-in-time hint: a small, non-blocking popover with the hint
 * body and a dismiss button. Anchored (with a caret from `side`) or centered by
 * the controller; unlike the tutorial coach-mark it has no backdrop and no
 * persistent tutorial controls.
 */
@Component({
  selector: 'app-hint-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LgButton, LgCaret],
  template: `
    <div
      *transloco="let t"
      class="pointer-events-auto relative flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-border bg-content p-3 shadow-lg"
      role="status"
    >
      @if (side(); as s) {
        <lg-caret [side]="s" />
      }
      <!-- Our own translated markup; trusted content. -->
      <p class="text-sm text-muted" [innerHTML]="text()"></p>
      <div class="flex items-center justify-end gap-1">
        <lg-button
          size="sm"
          severity="secondary"
          text
          [label]="t('onboarding.bubble.turnOff')"
          (onClick)="disableTips.emit()"
        ></lg-button>
        <lg-button
          size="sm"
          severity="secondary"
          text
          icon="ph ph-x"
          [ariaLabel]="t('onboarding.hints.dismiss')"
          (onClick)="dismiss.emit()"
        ></lg-button>
      </div>
    </div>
  `
})
export class HintPopoverComponent {
  public readonly text = input.required<string>();
  public readonly side = input<LgOverlaySide | null>(null);

  public readonly dismiss = output<void>();
  public readonly disableTips = output<void>();
}
