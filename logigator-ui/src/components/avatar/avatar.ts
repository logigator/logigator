import { Component, computed, input } from '@angular/core';
import { IconSlot } from '../../internal/icon';
import { LgImageSource } from '../../tokens/image-source';

/**
 * The rendered box per size, as both the utility classes and the CSS pixels a
 * `sizes` attribute has to state. One table, because the two cannot be allowed
 * to drift: a `sizes` that disagrees with the box makes the browser pick the
 * wrong rung of a `srcset` — invisibly, since either rung still draws.
 */
const BOX = {
  default: { classes: 'size-8 text-base', px: 32 },
  xlarge: { classes: 'size-16 text-2xl', px: 64 }
} as const;

/** One `<source>`: every width offered in a single encoding. */
interface FormatGroup {
  /** `undefined` for sources that named no format — then there is nothing to negotiate. */
  type: string | undefined;
  srcset: string;
}

/**
 * A user/entity avatar. Renders `image`, else `label` (an initial), else `icon`
 * — in that precedence. `shape="circle"` rounds it fully; `size="xlarge"` is the
 * large variant (default otherwise).
 *
 * `image` takes either a single URL or a list of {@link LgImageSource}s, in
 * which case the browser chooses: one `<source>` per encoding in the order
 * given (so the list's own order is the preference order — put WebP before its
 * fallback), each carrying every width as a `srcset`. The avatar knows the box
 * it draws in, so it states `sizes` itself and the device pixel ratio does the
 * rest.
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
  readonly size = input<'xlarge'>();

  private readonly box = computed(() => BOX[this.size() ?? 'default']);

  protected readonly sizes = computed(() => `${this.box().px}px`);

  protected readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center overflow-hidden bg-border text-text',
      this.shape() === 'circle' ? 'rounded-full' : 'rounded-md',
      this.box().classes
    ].join(' ')
  );

  /**
   * What to draw, or `undefined` when there is no image and the label/icon
   * fallbacks take over.
   *
   * The last encoding is the one on the `<img>` rather than on a `<source>`,
   * because that is what a browser matching none of the sources falls back to —
   * so the caller's least-preferred encoding is the one that has to work
   * everywhere. A single URL degrades to a bare `src`.
   */
  protected readonly picture = computed(
    ():
      | { groups: FormatGroup[]; src: string; srcset: string | null }
      | undefined => {
      const image = this.image();
      if (!image) return undefined;
      if (typeof image === 'string')
        return { groups: [], src: image, srcset: null };

      const groups = groupByFormat(image);
      const fallback = groups.pop();
      if (!fallback) return undefined;

      return {
        groups,
        // A `srcset` decides what is fetched, so `src` only matters to a client
        // that cannot read one; the narrowest rung is the cheapest thing to give it.
        src: fallback.sources[0].url,
        srcset: fallback.srcset
      };
    }
  );
}

/**
 * Splits the ladder into one entry per encoding, in the order the encodings
 * first appear — so the caller's ordering *is* the preference order, and this
 * component never has to hold an opinion about which formats are better.
 */
function groupByFormat(
  sources: readonly LgImageSource[]
): (FormatGroup & { sources: LgImageSource[] })[] {
  const byFormat = new Map<string | undefined, LgImageSource[]>();
  for (const source of sources) {
    const existing = byFormat.get(source.format);
    if (existing) existing.push(source);
    else byFormat.set(source.format, [source]);
  }

  return Array.from(byFormat, ([format, entries]) => ({
    type: mediaType(format),
    srcset: entries.map((s) => `${s.url} ${s.width}w`).join(', '),
    sources: entries
  }));
}

/**
 * `'jpg'` is a file extension, not a format name, and there is no
 * `image/jpg` — the two get confused often enough to be worth one line here.
 */
function mediaType(format: string | undefined): string | undefined {
  if (!format) return undefined;
  return `image/${format === 'jpg' ? 'jpeg' : format}`;
}
