import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core';
import { LgButton, LgCaret, type LgOverlaySide } from '@logigator/ui';
import { CoachMarkView } from '../coach-mark.model';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Presentational coach-mark bubble for one tutorial step: renders a
 * {@link CoachMarkView} and emits Next / Skip / Turn off all tips. Positioning
 * and the dim are the overlay controller's job; this only draws the caret from
 * `side`, which is `null` when the bubble is centred.
 */
@Component({
  selector: 'app-coach-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, LgButton, LgCaret],
  templateUrl: './coach-mark.component.html'
})
export class CoachMarkComponent {
  public readonly view = input.required<CoachMarkView>();
  public readonly side = input<LgOverlaySide | null>(null);

  public readonly next = output<void>();
  public readonly skip = output<void>();
}
