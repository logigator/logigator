import { Component, computed, input } from '@angular/core';
import { IconSlot } from '../../internal/icon';
import { pictureFor } from '../../internal/picture';
import { LgImageSource } from '../../tokens/image-source';

/**
 * The rendered box per size, as utility classes and as the CSS pixels `sizes`
 * states. One table because the two must not drift: a `sizes` disagreeing with
 * the box picks the wrong `srcset` rung, invisibly — either rung still draws.
 */
const BOX = {
  small: { classes: 'size-5 text-[9px]', px: 20 },
  default: { classes: 'size-8 text-base', px: 32 },
  xlarge: { classes: 'size-16 text-2xl', px: 64 }
} as const;

/**
 * A user/entity avatar, rendering `image`, else `label`, else `icon`.
 *
 * `image` takes a single URL or a list of {@link LgImageSource}s, which
 * becomes one `<source>` per encoding in the order given — the list's order is
 * the preference order, so put WebP before its fallback — each carrying every
 * width as a `srcset`. The avatar states `sizes` itself from the box it draws
 * in, and the device pixel ratio does the rest.
 */
@Component({
  selector: 'lg-avatar',
  host: { class: 'inline-flex' },
  template: `
    <span [class]="classes()">
      @if (picture(); as p) {
        <!-- display:contents so the <img> stays the flex item, as it is
             without a <picture> around it. -->
        <picture class="contents">
          @for (group of p.groups; track group.type) {
            <source
              [srcset]="group.srcset"
              [sizes]="sizes()"
              [attr.type]="group.type"
            />
          }
          <!-- attr. bindings, not property ones: assigning undefined to the
               srcset property writes the string "undefined" and the browser
               goes and fetches it, where the attribute is simply left off. -->
          <img
            [src]="p.src"
            [attr.srcset]="p.srcset"
            [attr.sizes]="p.srcset ? sizes() : null"
            alt=""
            class="h-full w-full object-cover"
          />
        </picture>
      } @else if (label()) {
        <span>{{ label() }}</span>
      } @else if (icon()) {
        <i [class]="icon()" aria-hidden="true"></i>
      }
    </span>
  `
})
export class LgAvatar {
  readonly image = input<string | readonly LgImageSource[]>();
  readonly label = input<string>();
  readonly icon = input<IconSlot>();
  readonly shape = input<'circle' | 'square'>('square');
  readonly size = input<'small' | 'xlarge'>();

  private readonly box = computed(() => BOX[this.size() ?? 'default']);

  protected readonly sizes = computed(() => `${this.box().px}px`);

  protected readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center overflow-hidden bg-border text-text',
      this.shape() === 'circle' ? 'rounded-full' : 'rounded-md',
      this.box().classes
    ].join(' ')
  );

  /** What to draw, or `undefined` when the label/icon fallbacks take over. */
  protected readonly picture = computed(() => pictureFor(this.image()));
}
