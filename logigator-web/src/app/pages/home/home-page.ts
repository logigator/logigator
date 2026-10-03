import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LgButton } from '@logigator/ui';
import { WireRun } from '../../design/wire-run';
import { CircuitTiles } from '../../documents/circuit-tiles';
import { toTileEntries } from '../../documents/circuit-tile-entry';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { HomeContentService } from './home-content.service';
import { homeVideo } from './home-video';
import { VideoEmbed } from './video-embed';

/**
 * The landing page: a board hero, the features, the examples shelf, the
 * explainer and the community's top projects and components.
 */
@Component({
  selector: 'web-home-page',
  imports: [
    CircuitTiles,
    EmptyState,
    LgButton,
    RouterLink,
    SectionError,
    TranslateDirective,
    VideoEmbed,
    WireRun
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  protected readonly FEATURES = [
    {
      key: 'performance',
      title: 'pages.home.features.performance.title',
      body: 'pages.home.features.performance.body'
    },
    {
      key: 'components',
      title: 'pages.home.features.components.title',
      body: 'pages.home.features.components.body'
    },
    {
      key: 'share',
      title: 'pages.home.features.share.title',
      body: 'pages.home.features.share.body'
    },
    {
      key: 'images',
      title: 'pages.home.features.images.title',
      body: 'pages.home.features.images.body'
    }
  ] as const;

  private readonly translation = inject(TranslationService);
  private readonly content = inject(HomeContentService);

  protected readonly links = inject(SiteLinks);

  protected readonly examples = this.content.examples;
  protected readonly projects = this.content.projects;
  protected readonly components = this.content.components;

  /**
   * The community's size, from the `total` the three listings on this page
   * already carry — every envelope counts the whole match rather than the page,
   * so this costs no request and nothing new per render, and the figures are
   * the public set by construction, every predicate behind them naming
   * `public = true`.
   *
   * A figure whose read failed is left out rather than shown as a zero: each
   * listing resolves independently, so one 503 must not blank the row. There is
   * no floor — the strip renders whatever the counts are, a section that
   * appears and disappears with the size of the database being a rule to
   * maintain and a home page nobody can screenshot twice.
   */
  protected readonly stats = computed(() => {
    const number = new Intl.NumberFormat(this.translation.activeLang());
    return (
      [
        { key: 'projects', total: this.projects.total() },
        { key: 'components', total: this.components.total() },
        { key: 'examples', total: this.examples.total() }
      ] as const
    )
      .filter((stat) => stat.total !== null)
      .map((stat) => ({
        key: stat.key,
        value: number.format(stat.total!),
        labelKey: `pages.home.stats.${stat.key}` as const
      }));
  });

  protected readonly videoCaption = computed(() => {
    const video = homeVideo(this.translation.activeLang());
    return `${video.title} · ${video.duration}`;
  });

  /**
   * The examples all belong to one account, so no author — and a curated shelf
   * is not a ranking, so no star count either: `meta: false` drops the row
   * rather than leaving a tally nobody is competing for. They open in the
   * editor by their share link, which needs no session — and the kind is a
   * literal, the list being that account's projects by construction, which is
   * also why a row carries none.
   */
  protected readonly exampleTiles = computed(() =>
    toTileEntries(this.examples.entries() ?? [], {
      href: (row) => this.links.editorShare('projects', row.link),
      external: true,
      meta: false
    })
  );

  protected readonly projectTiles = computed(() =>
    toTileEntries(this.projects.entries() ?? [], {
      href: (row) => `${this.links.communityProjects()}/${row.link}`,
      authorHref: (row) => this.links.communityUser(row.author.id)
    })
  );

  protected readonly componentTiles = computed(() =>
    toTileEntries(this.components.entries() ?? [], {
      href: (row) => `${this.links.communityComponents()}/${row.link}`,
      authorHref: (row) => this.links.communityUser(row.author.id)
    })
  );
}
