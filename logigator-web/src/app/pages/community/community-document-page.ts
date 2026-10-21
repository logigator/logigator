import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  hasLiveLink,
  LgAvatar,
  LgButton,
  LgMarkdown,
  LgMessage,
  LgTag
} from '@logigator/ui';
import { RETURN_PATH_PARAM } from '@logigator/core';
import type { DocumentTranslationResponse } from '@logigator/contract';
import { CommunityApiService } from '../../api/services/community-api.service';
import { ShareApiService } from '../../api/services/share-api.service';
import { shareCardUrl } from '../../documents/crawler-image';
import { CircuitPreview } from '../../documents/circuit-preview';
import { isPublishedButEmpty } from '../../documents/published-but-empty';
import { ShareControls } from '../../documents/share-controls';
import { VisibilityTag } from '../../documents/visibility-tag';
import { SiteLinks } from '../../layout/site-links';
import { SITE_ORIGIN } from '../../seo/site-origin';
import { SectionError } from '../../states/section-error';
import { genericFailureKey } from '../../forms/api-failure';
import { TranslationKey } from '../../translation/translation-key.model';
import { NotFoundPage } from '../not-found/not-found-page';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { apiKindOf } from './community-kind';
import { CommunityDocumentService } from './community-document.service';
import { StarIcon } from './star-icon';
import { realLanguage, textLangAttribute } from './text-language';

/**
 * One circuit, at the address its link is: its render, who made it, what it is
 * made of, and the two things a reader can do with it — open it in the editor,
 * or take a copy.
 *
 * The page renders in all three states. A published document is met by a reader
 * who picked it out of a listing; an unlisted one by whoever was handed its
 * link; a private one by nobody but its owner, who still gets the state on the
 * page rather than a URL that says nothing about it. What the states change is
 * here: the chip that names the state, the star affordances that only a listed
 * document can have, and the head's `noindex`, which is decided from the
 * visibility the guard resolved (`community-routes.ts`).
 *
 * The render is the active theme's alone, picked in TypeScript. Both themes are
 * separate renders and no `<picture>` negotiates a colour scheme, so drawing
 * the other one behind CSS would download an image nobody sees.
 *
 * A link naming nothing this reader may open renders the site's own 404, status
 * included: the alternative is a soft 404, which is indexable, and a share
 * token that was regenerated leaves exactly such a URL behind.
 */
@Component({
  selector: 'web-community-document-page',
  imports: [
    CircuitPreview,
    LgAvatar,
    LgButton,
    LgMarkdown,
    LgMessage,
    LgTag,
    NotFoundPage,
    RouterLink,
    SectionError,
    ShareControls,
    StarIcon,
    TranslateDirective,
    VisibilityTag
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
  private readonly communityApi = inject(CommunityApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly origin = inject(SITE_ORIGIN).replace(/\/+$/, '');

  protected readonly links = inject(SiteLinks);
  protected readonly document = this.content.document;
  protected readonly missing = this.content.missing;
  protected readonly failureKey = this.content.failureKey;
  protected readonly stars = this.content.stars;
  protected readonly starred = this.content.starred;
  protected readonly pendingAction = this.content.pendingAction;
  protected readonly actionFailureKey = this.content.actionFailureKey;
  protected readonly retrying = this.content.retrying;

  /**
   * The machine translation the reader asked for, while it is shown. Held here
   * and nowhere else: it is fetched on a click, so it is never in the server
   * render, the transfer state or the URL, and a crawler never sees it. It
   * belongs to the document it was fetched for and is dropped with it, which a
   * language switch does too.
   */
  private readonly machineText = linkedSignal<
    unknown,
    DocumentTranslationResponse | null
  >({ source: this.document, computation: () => null });

  protected readonly translating = signal(false);
  /** Why the last translation request failed, for the line under the button. */
  protected readonly translateFailureKey = linkedSignal<
    unknown,
    TranslationKey | null
  >({ source: this.document, computation: () => null });

  /**
   * The name and description the page shows, each with its language: the
   * read's own, or the machine text for each field the translation answered.
   * The read is never written to, so showing the original again restores it
   * exactly.
   */
  protected readonly shown = computed(() => {
    const document = this.document();
    if (!document) return null;
    const machine = this.machineText();
    const original = {
      name: document.name,
      nameLanguage: document.textLanguage.name,
      description: document.description,
      descriptionLanguage: document.textLanguage.description
    };
    if (!machine) return original;
    return {
      ...original,
      ...(machine.name !== null
        ? { name: machine.name, nameLanguage: machine.language }
        : {}),
      ...(machine.description !== null
        ? {
            description: machine.description,
            descriptionLanguage: machine.language
          }
        : {})
    };
  });

  /** `lang` for the heading and the description, where they differ from the page's. */
  protected readonly nameLang = computed(() =>
    textLangAttribute(
      this.shown()?.nameLanguage ?? null,
      this.translation.activeLang()
    )
  );
  protected readonly descriptionLang = computed(() =>
    textLangAttribute(
      this.shown()?.descriptionLanguage ?? null,
      this.translation.activeLang()
    )
  );

  /**
   * The note naming what the shown text was translated from. The description's
   * source where it was translated, since the note sits under it and a short
   * title is the likelier of the two to be detected wrongly; the name's
   * otherwise. Named by `Intl` because the source can be any language, not one
   * the locale files know.
   */
  protected readonly machineNote = computed(() => {
    const machine = this.machineText();
    if (!machine) return null;
    const source =
      (machine.description !== null
        ? realLanguage(machine.sourceLanguage.description)
        : null) ??
      (machine.name !== null
        ? realLanguage(machine.sourceLanguage.name)
        : null);
    const language = source ? this.languageName(source) : null;
    return language
      ? this.translation.translate(
          'pages.community.document.machineTranslatedFrom',
          { language }
        )
      : this.translation.translate(
          'pages.community.document.machineTranslated'
        );
  });

  /** The figure takes the fixed column, so it needs a `sizes` of its own. */
  protected readonly PREVIEW_SIZES = '(min-width: 768px) 336px, 100vw';

  protected readonly isComponent = computed(
    () => this.document()?.kind === 'components'
  );

  /**
   * Whether the document is in the community. Only a listed one is: an unlisted
   * one is reachable by its link and is in no listing, and starring is a
   * statement about a listing — the API answers for the starred set with the
   * same predicate the listings use, so this page drawing a star control for
   * anything else would offer an action the server refuses.
   */
  protected readonly isPublic = computed(
    () => this.document()?.visibility === 'public'
  );

  /**
   * Whether to tell the reader their published document is in no listing
   * because it is empty. The owner's alone: to anybody else the page is an
   * ordinary published one, and "not listed" is a fact about where the owner
   * expected to find it.
   */
  protected readonly emptyNotice = computed(() => {
    const document = this.document();
    return (
      !!document &&
      document.author.id === this.session.user()?.id &&
      isPublishedButEmpty(document)
    );
  });

  /**
   * Whether there is a URL worth handing on. Asked of `@logigator/ui` rather
   * than spelled out here, because it is the same question both share dialogs
   * ask of the same three states — the rule that says which state a link
   * resolves in is one rule, and a second spelling is how it comes to differ.
   *
   * A private document is the one it withholds: nobody but its owner can open
   * it, so a share sheet or an embed snippet would be offering to pass on a URL
   * that opens nothing.
   */
  protected readonly hasLink = computed(() => {
    const visibility = this.document()?.visibility;
    return visibility !== undefined && hasLiveLink(visibility);
  });

  /**
   * The kind in the spelling every `/api/share/…` URL names, for the two URLs
   * this page builds against the API rather than against one of its own routes:
   * the card a share surface is handed, and the clone. A project is what an
   * unresolved document answers with — both readers check the document first,
   * so no URL is ever built from it.
   */
  private readonly apiKind = computed(() =>
    apiKindOf(this.document()?.kind ?? 'projects')
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
    return document ? this.links.editorShare(document.kind, document.link) : '';
  });

  /**
   * What a reader passes on: this page, absolute. It is the page the link
   * itself addresses — one URL, whatever the document's state — so re-sharing
   * is idempotent and the recipient meets the same page the sharer was on.
   */
  protected readonly shareUrl = computed(() => {
    const document = this.document();
    return document
      ? `${this.origin}${this.links.communityDocument(document.kind, document.link)}`
      : '';
  });

  /** Absolute, because an embed is pasted onto somebody else's site. */
  protected readonly cardUrl = computed(() => {
    const document = this.document();
    return document
      ? `${this.origin}${shareCardUrl(this.apiKind(), document.link)}`
      : '';
  });

  protected readonly stargazersHref = computed(() => {
    const document = this.document();
    return document
      ? this.links.communityStargazers(document.kind, document.link)
      : '';
  });

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
      const clone = await firstValueFrom(
        this.shareApi.clone(this.apiKind(), document.link)
      );
      const copy = clone.kind === 'project' ? clone.project : clone.component;
      // A full document load, not a router navigation: the editor is a separate
      // deployment that happens to share this origin.
      window.location.href = this.links.editorDocument(document.kind, copy.id);
    } catch (error) {
      this.content.failAction(error);
    }
  }

  /**
   * Fetches the machine translation for the page's language and shows it. Asked
   * of the API directly every time, never through the hand-off: the response
   * must not reach the transfer state or any cache, which is what keeps the
   * machine text out of every page a crawler reads.
   */
  protected async translate(): Promise<void> {
    const document = this.document();
    if (!document || !this.isBrowser || this.translating()) return;

    this.translating.set(true);
    this.translateFailureKey.set(null);
    try {
      const machine = await firstValueFrom(
        this.communityApi.translation(
          document.kind,
          document.link,
          this.translation.activeLang()
        )
      );
      // A navigation while the request was out has replaced the document.
      if (this.document() === document) this.machineText.set(machine);
    } catch (error) {
      if (this.document() === document) {
        this.translateFailureKey.set(genericFailureKey(error));
      }
    } finally {
      this.translating.set(false);
    }
  }

  protected showOriginal(): void {
    this.machineText.set(null);
  }

  protected retry(): Promise<void> {
    return this.content.retry();
  }

  /** Falls back to the code for one `Intl` cannot name or will not take. */
  private languageName(code: string): string {
    try {
      return (
        new Intl.DisplayNames([this.translation.activeLang()], {
          type: 'language'
        }).of(code) ?? code
      );
    } catch {
      return code;
    }
  }

  private signIn(): Promise<boolean> {
    return this.router.navigate([this.links.login()], {
      queryParams: { [RETURN_PATH_PARAM]: this.router.url }
    });
  }
}
