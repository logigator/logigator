import { computed, inject, Injectable, Signal } from '@angular/core';
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
  public readonly features = this.path('/features');
  public readonly community = this.path('/community/projects');
  public readonly myProjects = this.path('/my/projects');
  public readonly myComponents = this.path('/my/components');
  public readonly account = this.path('/my/account');
  public readonly login = this.path('/login');
  public readonly register = this.path('/register');
  public readonly resetPassword = this.path('/reset-password');
  public readonly imprint = this.path('/imprint');
  public readonly privacyPolicy = this.path('/privacy-policy');

  /** The editor is a separate deployment sharing this origin. */
  public readonly editor = environment.editorUrl;

  public readonly repository = 'https://github.com/logigator/logigator';

  /** A path in this app, in the language the document renders in. */
  public path(path: string): Signal<string> {
    return computed(() => pathInLanguage(this.lang(), path));
  }
}
