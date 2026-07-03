import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LgCaret } from '../../internal/caret';
import { LgFadeIn } from '../../internal/fade-in';
import { LgOverlaySide } from '../../internal/overlay';
import { LgShortcut, LgShortcutBinding } from '../shortcut/shortcut';

/**
 * The tooltip bubble rendered inside the overlay: a raised `surface-700` box
 * with `surface-0` text in both schemes (dark-on-light / light-on-dark), plus a
 * caret that tracks the resolved {@link LgOverlaySide}. An optional `shortcut`
 * renders as {@link LgShortcut} chips after the text. Fades in on attach.
 */
@Component({
  selector: 'lg-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgCaret, LgFadeIn, LgShortcut],
  template: `
    <div
      lgFadeIn
      class="relative flex max-w-50 items-center gap-2 rounded-md bg-surface-700 px-3 py-2 text-surface-0 shadow-md"
    >
      {{ text() }}
      @if (shortcut(); as sc) {
        <lg-shortcut [binding]="sc" tone="raised" />
      }
      <lg-caret [side]="side()" tone="raised" />
    </div>
  `
})
export class LgTooltipPanel {
  readonly text = input('');
  readonly shortcut = input<LgShortcutBinding | null>(null);
  readonly side = input<LgOverlaySide>('right');
}
