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
import { ThemingService } from '../../theming/theming.service';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { HomeContentService } from './home-content.service';
import { homeVideo } from './home-video';
import { VideoEmbed } from './video-embed';
import heroLight from '../../../assets/hero-board-light.webp';
import heroDark from '../../../assets/hero-board-dark.webp';

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
  // A five-stop gradient that swaps axis at a breakpoint reads as noise in
  // arbitrary-value classes; `--hero-page` carries the scheme in, so the rule
  // itself needs no dark variant. 1024px is Tailwind's `lg`.
  styles: `
    .hero-scrim {
      background: linear-gradient(
        to bottom,
        var(--hero-page) 0%,
        var(--hero-page) 20%,
        color-mix(in srgb, var(--hero-page) 84%, transparent) 48%,
        color-mix(in srgb, var(--hero-page) 26%, transparent) 80%,
        transparent 100%
      );
    }

    @media (min-width: 1024px) {
      .hero-scrim {
        background: linear-gradient(
          to right,
          var(--hero-page) 0%,
          var(--hero-page) 42%,
          color-mix(in srgb, var(--hero-page) 66%, transparent) 60%,
          color-mix(in srgb, var(--hero-page) 16%, transparent) 82%,
          transparent 100%
        );
      }
    }
  `,
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
      key: 'subcircuits',
      title: 'pages.home.features.subcircuits.title',
      body: 'pages.home.features.subcircuits.body'
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

  private readonly theming = inject(ThemingService);
  private readonly translation = inject(TranslationService);
  private readonly content = inject(HomeContentService);

  protected readonly links = inject(SiteLinks);

  protected readonly examples = this.content.examples;
  protected readonly projects = this.content.projects;
  protected readonly components = this.content.components;

  /** One image, not two hidden by CSS: a `display:none` image still downloads. */
  protected readonly heroBoard = computed(() =>
    this.theming.isDark() ? heroDark : heroLight
  );

  protected readonly videoCaption = computed(() => {
    const video = homeVideo(this.translation.activeLang());
    return `${video.title} · ${video.duration}`;
  });

  /**
   * The examples all belong to one account, so no `authorHref` and no meta
   * row. They open in the editor by their share link, which needs no session.
   */
  protected readonly exampleTiles = computed(() =>
    toTileEntries(this.examples.entries() ?? [], {
      href: (row) => this.links.editorShare(row.link),
      external: true
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
