import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { caretClasses, LgButton, type LgOverlaySide } from '@logigator/ui';
import { CoachMarkView } from '../coach-mark.model';

/**
 * Presentational coach-mark bubble for one tutorial step. Knows nothing about
 * tutorials — it renders a {@link CoachMarkView} and emits the three controls
 * (Next / Skip / Turn off all tips). Positioning and the dim/highlight are the
 * overlay controller's job; this only draws the caret from `side` (the side the
 * bubble sits on relative to its anchor, `null` when centered).
 */
@Component({
  selector: 'app-coach-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LgButton],
  templateUrl: './coach-mark.component.html'
})
export class CoachMarkComponent {
  public readonly view = input.required<CoachMarkView>();
  public readonly side = input<LgOverlaySide | null>(null);

  public readonly next = output<void>();
  public readonly skip = output<void>();

  protected readonly caret = computed(() => {
    const side = this.side();
    return side ? `absolute size-2.5 ${caretClasses(side, 'content')}` : null;
  });
}
