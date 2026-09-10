import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LgAvatar,
  LgCircuitTile,
  LgCircuitTileAuthor,
  LgCircuitTileLink
} from '@logigator/ui';
import { ThemingService } from '../theming/theming.service';
import { TranslationService } from '../translation/translation.service';
import { CircuitTileEntry } from './circuit-tile-entry';

/** The widest the grid below goes; `lg:grid-cols-4` is where this comes from. */
const GRID_COLUMNS = 4;

/**
 * A list of circuits as tiles, either as a grid or as a rail that bleeds past
 * the page gutter. A grid of four says these are all of them; a rail says the
 * shelf continues, and the overflow is the scroll affordance itself.
 *
 * The preview is picked here rather than by the markup: both themes are
 * separate renders and no `<picture>` can negotiate a colour scheme, so hiding
 * one with CSS would download both.
 */
@Component({
  selector: 'web-circuit-tiles',
  imports: [
    LgAvatar,
    LgCircuitTile,
    LgCircuitTileAuthor,
    LgCircuitTileLink,
    RouterLink
  ],
  host: { class: 'block' },
  template: `
    <div [class]="layoutClass()">
      @for (tile of tiles(); track tile.id) {
        <lg-circuit-tile
          [name]="tile.name"
          [preview]="tile.preview"
          [stars]="tile.stars"
          [starsLabel]="starsLabel()"
          [loading]="tile.loading"
        >
          @if (tile.external) {
            <a
              lgCircuitTileLink
              target="_blank"
              rel="noopener"
              [href]="tile.href"
              [attr.aria-label]="tile.name"
            ></a>
          } @else {
            <a
              lgCircuitTileLink
              [routerLink]="tile.href"
              [attr.aria-label]="tile.name"
            ></a>
          }

          @if (tile.author; as author) {
            <a lgCircuitTileAuthor [routerLink]="author.href">
              <lg-avatar
                size="small"
                shape="circle"
                [image]="author.avatar ?? undefined"
                [label]="author.initials"
              />
              <span class="truncate">{{ author.name }}</span>
            </a>
          }
        </lg-circuit-tile>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitTiles {
  private readonly theming = inject(ThemingService);
  private readonly translation = inject(TranslationService);

  readonly entries = input.required<readonly CircuitTileEntry[]>();
  readonly layout = input<'grid' | 'rail'>('grid');

  /**
   * Whether this list is the first thing the page draws. The leading row then
   * loads eagerly: a lazy image that turns out to be the largest thing painted
   * costs a measurable delay, and the browser cannot know which one it is.
   *
   * How many tiles a row holds is this component's own knowledge — the grid
   * template is here — so a page says *where it is*, not how many to prioritize.
   */
  readonly aboveTheFold = input(false, { transform: booleanAttribute });

  protected readonly starsLabel = computed(() =>
    this.translation.translate('documents.stars')
  );

  protected readonly layoutClass = computed(() =>
    this.layout() === 'rail'
      ? '-mr-(--page-gutter) flex snap-x snap-proximity gap-4 overflow-x-auto pt-1 pb-4 ' +
        '[&>*]:w-66 [&>*]:shrink-0 [&>*]:snap-start'
      : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
  );

  protected readonly tiles = computed(() => {
    const dark = this.theming.isDark();
    // The widest the grid gets, which is where a whole row is above the fold.
    const eagerUpTo = this.aboveTheFold() ? GRID_COLUMNS : 0;
    return this.entries().map((entry, index) => ({
      id: entry.id,
      loading: index < eagerUpTo ? ('eager' as const) : ('lazy' as const),
      name: entry.name,
      href: entry.href,
      external: entry.external,
      preview: entry.preview
        ? dark
          ? entry.preview.dark
          : entry.preview.light
        : null,
      stars: entry.meta?.stars,
      author: entry.meta
        ? {
            href: entry.meta.authorHref,
            name: entry.meta.author.username,
            avatar: entry.meta.author.avatar,
            initials: entry.meta.author.username.slice(0, 2).toUpperCase()
          }
        : null
    }));
  });
}
