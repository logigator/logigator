import { Component, input } from '@angular/core';
import { LgCaret } from '../../internal/caret';
import { LgFadeIn } from '../../internal/fade-in';
import { LgOverlaySide } from '../../internal/overlay';
import { LgShortcut, LgShortcutBinding } from '../shortcut/shortcut';

/**
 * The tooltip bubble rendered inside the overlay: the content surface with the
 * standard panel border in light (so it stands off same-colored surfaces) and
 * a borderless raised `surface-700` box with `surface-0` text in dark, plus a
 * caret that tracks the resolved {@link LgOverlaySide}. An optional `shortcut`
 * renders as {@link LgShortcut} chips after the text. Fades in on attach.
 */
@Component({
  selector: 'lg-tooltip-panel',
  imports: [LgCaret, LgFadeIn, LgShortcut],
  template: `
    <div
      lgFadeIn
      class="relative flex max-w-50 items-center gap-2 rounded-md border border-border bg-content px-3 py-2 text-text shadow-md dark:border-transparent dark:bg-surface-700 dark:text-surface-0"
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
