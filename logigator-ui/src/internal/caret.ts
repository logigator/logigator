import { Component, computed, input } from '@angular/core';
import {
  caretClasses,
  caretRunsAlongX,
  LgCaretTone,
  LgOverlaySide
} from './overlay';

/**
 * The diamond caret an anchored overlay parks on its edge to point at the
 * anchor. Place it as the last child of the panel's `relative` container; it
 * positions itself from `side` and takes its surface from `tone`. Exported
 * for consumers building their own overlays on {@link LgOverlayService},
 * paired with `caretSideChanges`.
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
   * Pixels to slide the caret along its edge, away from the default centre;
   * `caretOffsetFor` computes it. Positive is right, or down on a side panel.
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
