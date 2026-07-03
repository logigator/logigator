import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal
} from '@angular/core';
import { afterPaint } from '../../internal/after-paint';
import { LgCaret } from '../../internal/caret';
import { LgOverlaySide } from '../../internal/overlay';

/**
 * The tooltip bubble rendered inside the overlay: a raised `surface-700` box
 * with `surface-0` text in both schemes (dark-on-light / light-on-dark), plus a
 * caret that tracks the resolved {@link LgOverlaySide}. Fades in on attach (the
 * transparent "from" state paints first, see {@link afterPaint}).
 */
@Component({
  selector: 'lg-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgCaret],
  template: `
    <!-- opacity-0 is also static so the bubble is transparent from the very
         first paint (bindings only apply on the first change-detection tick);
         the binding then lifts it and the fade-in runs. -->
    <div
      class="relative max-w-50 rounded-md bg-surface-700 px-3 py-2 text-surface-0 opacity-0 shadow-md transition-opacity duration-200"
      [class.opacity-0]="!shown()"
    >
      {{ text() }}
      <lg-caret [side]="side()" tone="tooltip" />
    </div>
  `
})
export class LgTooltipPanel {
  readonly text = input('');
  readonly side = input<LgOverlaySide>('right');

  protected readonly shown = signal(false);

  constructor() {
    afterPaint(() => this.shown.set(true));
  }
}
