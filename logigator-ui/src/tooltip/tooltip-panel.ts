import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';
import { caretClasses, LgOverlaySide } from '../internal/overlay';

/**
 * The tooltip bubble rendered inside the overlay. `content`-background with a
 * shadow (the editor's light-mode tooltip override, made the default) and a
 * caret that tracks the resolved {@link LgOverlaySide}.
 */
@Component({
  selector: 'lg-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative max-w-xs rounded-md bg-content px-2 py-1 text-sm text-text shadow-lg"
    >
      {{ text() }}
      <span
        aria-hidden="true"
        class="absolute h-0 w-0"
        [class]="caret()"
      ></span>
    </div>
  `
})
export class LgTooltipPanel {
  readonly text = input('');
  readonly side = input<LgOverlaySide>('right');

  protected readonly caret = computed(() => caretClasses(this.side()));
}
