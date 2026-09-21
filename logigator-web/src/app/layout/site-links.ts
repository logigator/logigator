import { computed, inject, Injectable, Signal } from '@angular/core';
import { DocPageId } from '@logigator/docs';
import { documentPath } from '@logigator/ui';
import { CommunityKind } from '../api/services/community-api.service';
import { environment } from '../../environments/environment';
import { pathInLanguage } from '../translation/language-url';
import { TranslationService } from '../translation/translation.service';

/**
 * Every in-app destination, already carrying the document's language prefix.
 *
 * Signals, because the language is part of the path and the document can switch
 * to another one in place: a link read in a template re-prefixes itself when it
 * does. The two absolute URLs are plain strings — they belong to deployments of
 * their own and carry no language.
 */
@Injectable({ providedIn: 'root' })
export class SiteLinks {
  private readonly lang = inject(TranslationService).activeLang;

  public readonly home = this.path('/');
  public readonly docs = this.path('/docs');
  public readonly examples = this.path('/examples');
  public readonly communityProjects = this.path('/community/projects');
  public readonly communityComponents = this.path('/community/components');
  public readonly myProjects = this.path('/my/projects');
  public readonly myComponents = this.path('/my/components');
  public readonly account = this.path('/my/account');
  public readonly login = this.path('/login');
  public readonly register = this.path('/register');
  public readonly resetPassword = this.path('/reset-password');
  public readonly changelog = this.path('/changelog');
  /** The changelog's Atom feed, which the server writes rather than the app. */
  public readonly changelogFeed = this.path('/changelog.atom');
  public readonly imprint = this.path('/imprint');
  public readonly privacyPolicy = this.path('/privacy-policy');

  /** The editor is a separate deployment sharing this origin. */
  public readonly editor = environment.editorUrl;

  public readonly repository = 'https://github.com/logigator/logigator';

  /** One documentation page. Reactive when read in a reactive context. */
  public docsPage(page: DocPageId): string {
    return pathInLanguage(this.lang(), `/docs/${page}`);
  }

  /** A member's public profile. Reactive when read in a reactive context. */
  public communityUser(id: string): string {
    return pathInLanguage(this.lang(), `/community/users/${id}`);
  }

  /** One of a member's four public listings. */
  public communityUserSection(
    id: string,
    section: '' | 'components' | 'starred/projects' | 'starred/components'
  ): string {
    const suffix = section ? `/${section}` : '';
    return pathInLanguage(this.lang(), `/community/users/${id}${suffix}`);
  }

  /**
   * A document's own page, addressed by its share link — the token is the
   * address rather than a grant, so what it resolves to is the state's business
   * and regenerating it takes the page down with it.
   *
   * The path is `@logigator/ui`'s, the one the editor's share dialog hands out:
   * a document's page is a URL two apps emit, so it is built in one place
   * rather than spelled the same way twice.
   */
  public communityDocument(kind: CommunityKind, link: string): string {
    return pathInLanguage(this.lang(), documentPath(kind, link));
  }

  public communityStargazers(kind: CommunityKind, link: string): string {
    return pathInLanguage(
      this.lang(),
      `${documentPath(kind, link)}/stargazers`
    );
  }

  /**
   * The editor, opening a document by its share link — which it loads without
   * a session, a link being what resolves it rather than the caller's account.
   *
   * The kind is the route's spelling, as it is in {@link communityDocument}:
   * the two spellings of it are different types, so a caller cannot hand this
   * the API's. The editor resolves the kind-free `/editor/share/{link}` the
   * legacy editor minted as well, and rewrites such a URL to this one.
   */
  public editorShare(kind: CommunityKind, link: string): string {
    return `${this.editor}/share/${kind}/${link}`;
  }

  /**
   * A cloud document open for editing. `/project/:uuid` and `/component/:uuid`
   * are the editor's own routes; this is where a clone lands, the copy being in
   * the caller's account rather than reachable through the original's link.
   */
  public editorDocument(kind: CommunityKind, id: string): string {
    return `${this.editor}/${kind === 'projects' ? 'project' : 'component'}/${id}`;
  }

  /** A path in this app, in the language the document renders in. */
  public path(path: string): Signal<string> {
    return computed(() => pathInLanguage(this.lang(), path));
  }
}
