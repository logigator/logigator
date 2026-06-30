import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LgCaret } from '../../internal/caret';
import { LgOverlaySide } from '../../internal/overlay';

/**
 * The tooltip bubble rendered inside the overlay. `content`-background with a
 * shadow and a caret that tracks the resolved {@link LgOverlaySide}.
 */
@Component({
  selector: 'lg-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgCaret],
  template: `
    <div
      class="relative max-w-xs rounded-md bg-content px-2 py-1 text-sm text-text shadow-lg"
    >
      {{ text() }}
      <lg-caret [side]="side()" />
    </div>
  `
})
export class LgTooltipPanel {
  readonly text = input('');
  readonly side = input<LgOverlaySide>('right');
}
