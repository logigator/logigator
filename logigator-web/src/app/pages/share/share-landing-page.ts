import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LgAvatar, LgButton, LgTag } from '@logigator/ui';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { ShareApiService } from '../../api/services/share-api.service';
import { shareCardUrl } from '../../documents/crawler-image';
import { CircuitPreview } from '../../documents/circuit-preview';
import { ShareControls } from '../../documents/share-controls';
import { SiteLinks } from '../../layout/site-links';
import { SITE_ORIGIN } from '../../seo/site-origin';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { NotFoundPage } from '../not-found/not-found-page';
import { ShareLandingService } from './share-landing.service';

/**
 * Where a link somebody was handed lands: the circuit, who made it, and the two
 * things the reader can do with it — open it in the editor, or take a copy.
 *
 * The site's page rather than the editor's own `/share/:link` route, because a
 * shared link has to unfurl: the editor is a static SPA shell whose `index.html`
 * carries one generic card for every URL, and no scraper runs the JavaScript
 * that would draw the circuit's own.
 *
 * A token that names nothing renders the site's own 404, status included — a
 * soft 404 is indexable, and a regenerated link leaves exactly such a URL
 * behind. The page carries `noindex` for the same reason: it answers a
 * capability, so a circuit its owner never published must not reach an index by
 * way of somebody pasting the link.
 */
@Component({
  selector: 'web-share-landing-page',
  imports: [
    CircuitPreview,
    LgAvatar,
    LgButton,
    LgTag,
    NotFoundPage,
    RouterLink,
    SectionError,
    ShareControls,
    TranslateDirective
  ],
  templateUrl: './share-landing-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareLandingPage {
  private readonly content = inject(ShareLandingService);
  private readonly shareApi = inject(ShareApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  private readonly origin = inject(SITE_ORIGIN).replace(/\/+$/, '');

  protected readonly links = inject(SiteLinks);
  protected readonly share = this.content.share;
  protected readonly missing = this.content.missing;
  protected readonly failureKey = this.content.failureKey;
  protected readonly cloning = this.content.cloning;
  protected readonly actionFailureKey = this.content.actionFailureKey;
  protected readonly retrying = this.content.retrying;

  /** The figure takes the fixed column, so it needs a `sizes` of its own. */
  protected readonly PREVIEW_SIZES = '(min-width: 768px) 336px, 100vw';

  protected readonly summary = this.content.summary;
  protected readonly author = computed(() => this.share()?.author ?? null);

  /** A component's port surface and symbol; a project has neither. */
  protected readonly ports = computed(() => {
    const share = this.share();
    return share?.kind === 'component'
      ? {
          symbol: share.component.symbol,
          inputs: share.component.numInputs,
          outputs: share.component.numOutputs
        }
      : null;
  });

  /**
   * Fork lineage, root-first. The immediate parent is the last link in the
   * chain, which is the one the community page names — the ancestors carry no
   * share link of their own, so this line names them rather than linking them.
   */
  protected readonly forkedFrom = computed(() => {
    const attribution = this.share()?.attribution ?? [];
    return attribution.at(-1) ?? null;
  });

  /** Mono carries every number here, which is what the counts are. */
  protected readonly counts = computed(() => {
    const summary = this.summary();
    const share = this.share();
    if (!summary || !share) return null;
    const number = new Intl.NumberFormat(this.translation.activeLang());
    return {
      components: number.format(summary.componentCount),
      wires: number.format(summary.wireCount),
      stars: number.format(share.stars)
    };
  });

  /** A calendar date, written in UTC: a zone west of midnight names the day
   * before, and an edit date is not a moment the reader cares about. */
  protected readonly edited = computed(() => {
    const summary = this.summary();
    return summary
      ? new Intl.DateTimeFormat(this.translation.activeLang(), {
          dateStyle: 'medium',
          timeZone: 'UTC'
        }).format(new Date(summary.lastEditedAt))
      : '';
  });

  protected readonly initials = computed(() =>
    (this.author()?.username ?? '').slice(0, 2).toUpperCase()
  );

  /** The author's public profile, which exists whether or not this is published. */
  protected readonly authorHref = computed(() => {
    const author = this.author();
    return author ? this.links.communityUser(author.id) : '';
  });

  /** The editor's own route for this token — a destination, not an address. */
  protected readonly openHref = computed(() => {
    const link = this.summary()?.link;
    return link ? this.links.editorShare(link) : '';
  });

  /**
   * The page's own address, absolute: this is what a reader passes on, and
   * handing out the *prefixed* form is deliberate — the language switch is a
   * navigation, so a recipient meets the page in the language it was shared in
   * and can move from there.
   */
  protected readonly shareUrl = computed(() => {
    const link = this.summary()?.link;
    return link ? `${this.origin}${this.links.shareLanding(link)}` : '';
  });

  /** Absolute, because the embed is pasted onto somebody else's site. */
  protected readonly cardUrl = computed(() => {
    const link = this.summary()?.link;
    return link ? `${this.origin}${shareCardUrl(link)}` : '';
  });

  protected readonly communityHref = computed(() => {
    const summary = this.summary();
    return summary
      ? this.links.communityDocument(this.content.kind(), summary.link)
      : '';
  });

  /**
   * Takes a copy into the reader's account and opens it, the editor being where
   * a copy is for. A component is addressed by its own cloud route, the same
   * one the community page sends a clone to.
   */
  protected async clone(): Promise<void> {
    const summary = this.summary();
    if (!summary || this.cloning()) return;

    if (!this.session.user()) {
      await this.signIn();
      return;
    }

    this.content.beginClone();
    try {
      const clone = await firstValueFrom(this.shareApi.clone(summary.link));
      const copy = clone.kind === 'project' ? clone.project : clone.component;
      // A full document load, not a router navigation: the editor is a separate
      // deployment that happens to share this origin.
      window.location.href = this.links.editorDocument(
        this.content.kind(),
        copy.id
      );
    } catch (error) {
      this.content.failClone(error);
    }
  }

  protected retry(): Promise<void> {
    return this.content.retry();
  }

  private signIn(): Promise<boolean> {
    return this.router.navigate([this.links.login()], {
      queryParams: { [RETURN_PATH_PARAM]: this.router.url }
    });
  }
}
