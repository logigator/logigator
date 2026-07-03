import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';
import { caretClasses, LgCaretTone, LgOverlaySide } from './overlay';

/**
 * The little diamond caret that an anchored overlay (Tooltip, Popover,
 * ConfirmPopup) parks on its edge to point at the anchor, carrying the panel's
 * border on its protruding edges. Place it as the last child of the panel's
 * `relative` container; it positions itself from `side` (the side the panel
 * sits on relative to the anchor) and takes its surface from `tone` —
 * `content` for `bg-content` panels, `raised` for the elevated chrome (the
 * tooltip bubble).
 *
 * Internal — not part of the public API.
 */
@Component({
  selector: 'lg-caret',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { 'aria-hidden': 'true', '[class]': 'classes()' }
})
export class LgCaret {
  readonly side = input.required<LgOverlaySide>();
  readonly tone = input<LgCaretTone>('content');

  protected readonly classes = computed(
    () => `absolute size-2.5 ${caretClasses(this.side(), this.tone())}`
  );
}
