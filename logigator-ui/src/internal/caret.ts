import { Component, computed, input } from '@angular/core';
import {
  caretClasses,
  caretRunsAlongX,
  LgCaretTone,
  LgOverlaySide
} from './overlay';

/**
 * The little diamond caret that an anchored overlay (Tooltip, Popover,
 * ConfirmPopup) parks on its edge to point at the anchor, carrying the panel's
 * border on its protruding edges. Place it as the last child of the panel's
 * `relative` container; it positions itself from `side` (the side the panel
 * sits on relative to the anchor) and takes its surface from `tone` —
 * `content` for `bg-content` panels, `raised` for the elevated chrome (the
 * tooltip bubble). Exported for consumers that build their own anchored
 * overlays on {@link LgOverlayService} (pair with `caretSideChanges`).
 */
@Component({
  selector: 'lg-caret',
  template: '',
  host: {
    'aria-hidden': 'true',
    '[class]': 'classes()',
    '[style.margin-left.px]': 'inlineOffset()',
    '[style.margin-top.px]': 'blockOffset()'
  }
})
export class LgCaret {
  readonly side = input.required<LgOverlaySide>();
  readonly tone = input<LgCaretTone>('content');
  /**
   * Pixels to slide the caret along the panel edge it sits on, from the centre
   * it defaults to — see `caretOffsetFor`, which computes it. Positive is right
   * (a panel above/below the anchor) or down (a panel beside it).
   */
  readonly offset = input(0);

  private readonly alongX = computed(() => caretRunsAlongX(this.side()));

  protected readonly inlineOffset = computed(() =>
    this.alongX() ? this.offset() : 0
  );
  protected readonly blockOffset = computed(() =>
    this.alongX() ? 0 : this.offset()
  );

  protected readonly classes = computed(
    () => `absolute size-2.5 ${caretClasses(this.side(), this.tone())}`
  );
}
