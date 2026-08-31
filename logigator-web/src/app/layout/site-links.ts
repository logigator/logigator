import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { pathInLanguage } from '../translation/language-url';
import { LanguageId } from '../translation/languages';
import { TranslationService } from '../translation/translation.service';

/**
 * Every in-app destination, already carrying the document's language prefix.
 *
 * A page's language cannot change without a document load — the switch rewrites
 * the URL — so these are plain strings rather than signals, and a template can
 * bind one straight to `routerLink`.
 */
@Injectable({ providedIn: 'root' })
export class SiteLinks {
  private readonly lang = inject(TranslationService).getActiveLang();

  public readonly home = this.path('/');
  public readonly features = this.path('/features');
  public readonly community = this.path('/community/projects');
  public readonly myProjects = this.path('/my/projects');
  public readonly myComponents = this.path('/my/components');
  public readonly account = this.path('/my/account');
  public readonly login = this.path('/login');
  public readonly register = this.path('/register');
  public readonly imprint = this.path('/imprint');
  public readonly privacyPolicy = this.path('/privacy-policy');

  /** The editor is a separate deployment sharing this origin. */
  public readonly editor = environment.editorUrl;

  public readonly repository = 'https://github.com/logigator/logigator';

  /** A path in this app, language-prefixed. */
  public path(path: string): string {
    return pathInLanguage(this.lang, path);
  }

  /** The URL currently open, in another language. */
  public inLanguage(lang: LanguageId, pathname: string): string {
    return pathInLanguage(lang, pathname);
  }
}
