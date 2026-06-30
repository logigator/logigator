import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';
import { IconSlot } from '../internal/icon';

/**
 * A user/entity avatar. Renders `image`, else `label` (an initial), else `icon`
 * — in that precedence. `shape="circle"` rounds it fully; `size="xlarge"` is the
 * large variant (default otherwise).
 */
@Component({
  selector: 'lg-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span [class]="classes()">
      @if (image()) {
        <img [src]="image()" alt="" class="h-full w-full object-cover" />
      } @else if (label()) {
        <span>{{ label() }}</span>
      } @else if (icon()) {
        <i [class]="icon()" aria-hidden="true"></i>
      }
    </span>
  `
})
export class LgAvatar {
  readonly image = input<string>();
  readonly label = input<string>();
  readonly icon = input<IconSlot>();
  readonly shape = input<'circle' | 'square'>('square');
  readonly size = input<'xlarge'>();

  protected readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center overflow-hidden bg-border text-text',
      this.shape() === 'circle' ? 'rounded-full' : 'rounded-md',
      this.size() === 'xlarge' ? 'size-16 text-2xl' : 'size-8 text-base'
    ].join(' ')
  );
}
