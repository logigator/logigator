import {
  Component,
  computed,
  contentChild,
  Directive,
  input
} from '@angular/core';
import { pictureFor } from '../../internal/picture';
import { LgImageSource } from '../../tokens/image-source';

/**
 * The tile's own destination, stretched over the whole card so anywhere that
 * is not another control opens it. It carries no text, so it needs an
 * `aria-label`; the consumer owns the routing.
 */
@Directive({
  selector: 'a[lgCircuitTileLink]',
  host: {
    class:
      'absolute inset-0 rounded-md focus-visible:outline focus-visible:outline-1 ' +
      'focus-visible:-outline-offset-3 focus-visible:outline-primary'
  }
})
export class LgCircuitTileLink {}

/**
 * The author, as a destination of its own. `z-1` is what lifts it out from
 * under {@link LgCircuitTileLink}'s overlay.
 */
@Directive({
  selector: 'a[lgCircuitTileAuthor]',
  host: {
    class:
      'relative z-1 inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-text ' +
      'hover:underline focus-visible:outline focus-visible:outline-1 ' +
      'focus-visible:outline-offset-2 focus-visible:outline-primary'
  }
})
export class LgCircuitTileAuthor {}

/**
 * One circuit — a project or a library component — as a tile: preview, name,
 * and the author and star count that say it is somebody's.
 *
 * The card is not itself an anchor, because the author inside it is a
 * destination of its own and anchors cannot nest. The consumer projects
 * `a[lgCircuitTileLink]`, which covers the card, and `a[lgCircuitTileAuthor]`,
 * which sits above it — so both are real links the consumer routes, and
 * neither is inside the other.
 *
 * `preview` is one theme's ladder, not both, since no `<picture>` can
 * negotiate a colour scheme. `starsLabel` is the word a screen reader reads
 * after the count.
 */
@Component({
  selector: 'lg-circuit-tile',
  host: {
    class:
      'relative flex flex-col overflow-hidden rounded-md border border-border ' +
      'bg-content transition-colors hover:border-primary'
  },
  template: `
    <!-- Square, because the render is: a wider frame only bands or crops it.
         The padding keeps the board off the frame's edges, and containing it
         is what fits a preview of another shape rather than cutting it. -->
    <span
      class="block aspect-square w-full border-b border-border bg-surface-100 p-2 dark:bg-surface-800"
    >
      @if (picture(); as p) {
        <!-- display:contents so the <img> sizes against the padded box. -->
        <picture class="contents">
          @for (group of p.groups; track group.type) {
            <source
              [srcset]="group.srcset"
              [sizes]="PREVIEW_SIZES"
              [attr.type]="group.type"
            />
          }
          <img
            [src]="p.src"
            [attr.srcset]="p.srcset"
            [attr.sizes]="p.srcset ? PREVIEW_SIZES : null"
            alt=""
            loading="lazy"
            class="h-full w-full object-contain"
          />
        </picture>
      }
    </span>

    <span class="flex flex-col gap-2 px-3.5 pt-3 pb-3.5">
      <span class="truncate text-[15px] font-medium text-text-hover">{{
        name()
      }}</span>

      @if (author() || stars() !== undefined) {
        <span
          class="flex items-center justify-between gap-2.5 text-[13px] text-muted"
        >
          <ng-content select="a[lgCircuitTileAuthor]" />
          @if (stars() !== undefined) {
            <span class="inline-flex shrink-0 items-center gap-1">
              <i class="ph ph-star" aria-hidden="true"></i>
              <span class="font-mono tabular-nums">{{ stars() }}</span>
              @if (starsLabel(); as label) {
                <!-- Interpolated space: Angular drops a whitespace-only text
                     node, and this would be read as “214stars”. -->
                <span class="sr-only">{{ ' ' + label }}</span>
              }
            </span>
          }
        </span>
      }
    </span>

    <ng-content select="a[lgCircuitTileLink]" />
  `
})
export class LgCircuitTile {
  readonly name = input.required<string>();
  readonly preview = input<readonly LgImageSource[] | null>();
  readonly stars = input<number>();
  readonly starsLabel = input<string>();

  protected readonly author = contentChild(LgCircuitTileAuthor);

  /** A quarter of a 1280px page at the widest, a whole phone at the narrowest. */
  protected readonly PREVIEW_SIZES = '(min-width: 1040px) 320px, 100vw';

  protected readonly picture = computed(() => pictureFor(this.preview()));
}
