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
import { CircuitPreview } from '../../documents/circuit-preview';
import { SiteLinks } from '../../layout/site-links';
import { SectionError } from '../../states/section-error';
import { NotFoundPage } from '../not-found/not-found-page';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { CommunityDocumentService } from './community-document.service';

/**
 * One published circuit: its render, who made it, what it is made of, and the
 * two things a reader can do with it — open it in the editor, or take a copy.
 *
 * The render is the active theme's alone, picked in TypeScript. Both themes are
 * separate renders and no `<picture>` negotiates a colour scheme, so drawing
 * the other one behind CSS would download an image nobody sees.
 *
 * A link naming nothing published renders the site's own 404, status included:
 * the alternative is a soft 404, which is indexable, and a share token that was
 * regenerated leaves exactly such a URL behind.
 */
@Component({
  selector: 'web-community-document-page',
  imports: [
    CircuitPreview,
    LgAvatar,
    LgButton,
    LgTag,
    NotFoundPage,
    RouterLink,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './community-document-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityDocumentPage {
  private readonly content = inject(CommunityDocumentService);
  private readonly shareApi = inject(ShareApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);

  protected readonly links = inject(SiteLinks);
  protected readonly document = this.content.document;
  protected readonly missing = this.content.missing;
  protected readonly failureKey = this.content.failureKey;
  protected readonly stars = this.content.stars;
  protected readonly starred = this.content.starred;
  protected readonly pendingAction = this.content.pendingAction;
  protected readonly actionFailureKey = this.content.actionFailureKey;
  protected readonly retrying = this.content.retrying;

  /** The figure takes the fixed column, so it needs a `sizes` of its own. */
  protected readonly PREVIEW_SIZES = '(min-width: 768px) 336px, 100vw';

  protected readonly isComponent = computed(
    () => this.document()?.kind === 'components'
  );

  /** A component's port surface and symbol; a project has neither. */
  protected readonly ports = computed(() => {
    const document = this.document();
    return document?.kind === 'components'
      ? {
          symbol: document.symbol,
          inputs: document.numInputs,
          outputs: document.numOutputs
        }
      : null;
  });

  /** Mono carries every number here, which is what the counts are. */
  protected readonly counts = computed(() => {
    const document = this.document();
    if (!document) return null;
    const number = new Intl.NumberFormat(this.translation.activeLang());
    return {
      components: number.format(document.componentCount),
      wires: number.format(document.wireCount),
      stars: number.format(this.stars())
    };
  });

  /** A calendar date, written in UTC: a zone west of midnight names the day
   * before, and an edit date is not a moment the reader cares about. */
  protected readonly edited = computed(() => {
    const document = this.document();
    return document
      ? new Intl.DateTimeFormat(this.translation.activeLang(), {
          dateStyle: 'medium',
          timeZone: 'UTC'
        }).format(new Date(document.lastEditedAt))
      : '';
  });

  protected readonly authorHref = computed(() => {
    const document = this.document();
    return document ? this.links.communityUser(document.author.id) : '';
  });

  protected readonly parentHref = computed(() => {
    const document = this.document();
    return document?.forkedFrom
      ? this.links.communityDocument(document.kind, document.forkedFrom.link)
      : '';
  });

  protected readonly openHref = computed(() => {
    const document = this.document();
    return document ? this.links.editorShare(document.link) : '';
  });

  protected readonly stargazersHref = computed(() => {
    const document = this.document();
    return document
      ? this.links.communityStargazers(document.kind, document.link)
      : '';
  });

  protected readonly initials = computed(() =>
    (this.document()?.author.username ?? '').slice(0, 2).toUpperCase()
  );

  /**
   * Starring, or the sign-in that has to happen first. A visitor is sent to the
   * form with this page as the return path, so the star is one click away when
   * they come back rather than a page they have to find again.
   */
  protected toggleStar(): void {
    if (!this.session.user()) {
      void this.signIn();
      return;
    }
    void this.content.setStar(!this.starred());
  }

  /**
   * Takes a copy into the reader's account and opens it. `/my/projects` does
   * not exist yet, and the copy exists to be edited — so the editor, on the
   * copy's own cloud route, is where a clone lands rather than a list.
   */
  protected async clone(): Promise<void> {
    const document = this.document();
    if (!document || this.pendingAction()) return;

    if (!this.session.user()) {
      await this.signIn();
      return;
    }

    this.content.beginAction('clone');
    try {
      const clone = await firstValueFrom(this.shareApi.clone(document.link));
      const copy = clone.kind === 'project' ? clone.project : clone.component;
      // A full document load, not a router navigation: the editor is a separate
      // deployment that happens to share this origin.
      window.location.href = this.links.editorDocument(document.kind, copy.id);
    } catch (error) {
      this.content.failAction(error);
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
