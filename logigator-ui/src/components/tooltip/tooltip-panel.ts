import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LgCaret } from '../../internal/caret';
import { LgOverlaySide } from '../../internal/overlay';

/**
 * The tooltip bubble rendered inside the overlay: a raised `surface-700` box
 * with `surface-0` text in both schemes (dark-on-light / light-on-dark), plus a
 * caret that tracks the resolved {@link LgOverlaySide}.
 */
@Component({
  selector: 'lg-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgCaret],
  template: `
    <div
      class="relative max-w-50 rounded-md bg-surface-700 px-3 py-2 text-surface-0 shadow-md"
    >
      {{ text() }}
      <lg-caret [side]="side()" tone="tooltip" />
    </div>
  `
})
export class LgTooltipPanel {
  readonly text = input('');
  readonly side = input<LgOverlaySide>('right');
}
