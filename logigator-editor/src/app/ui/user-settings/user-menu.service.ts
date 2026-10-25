import { computed, inject, Injectable, Signal } from '@angular/core';
import type { MenuItem } from '@logigator/ui';
import { UserService } from '../../user/user.service';
import { SessionLifecycleService } from '../../user/session-lifecycle.service';
import { TranslationService } from '../../translation/translation.service';

/**
 * The website's pages the account rows open. Unprefixed: the site redirects
 * to the language the shared cookie names, which is the editor's own.
 */
const ACCOUNT_URL = '/my/account';
const LOGIN_URL = '/login';
const REGISTER_URL = '/register';

/**
 * The user panel's model — who is signed in, and the account action rows —
 * defined once for the title bar's control and the compact sheet that renders
 * the panel on its own.
 *
 * The rows are rebuilt whenever the active language changes, as every other
 * menu model is: `translate()` reads the post-load signal. The pages they
 * name belong to the website, so each is a link opening in a tab of its own —
 * the board stays where it was, and the sign-in the tab completes reaches this
 * one through the shared session cookie.
 */
@Injectable({ providedIn: 'root' })
export class UserMenuService {
  private readonly userService = inject(UserService);
  private readonly sessionLifecycle = inject(SessionLifecycleService);
  private readonly translation = inject(TranslationService);

  public readonly username = computed(() => this.userService.user()?.username);

  /**
   * The avatar ladder the API encoded, untouched: the browser picks the width
   * for its pixel ratio and the first encoding it can decode. An account with
   * no avatar answers `null`, and an empty ladder says the same thing; either
   * way the panel falls back to the username's initial.
   */
  public readonly avatar = computed(() => {
    const variants = this.userService.user()?.avatar;
    return variants?.length ? variants : undefined;
  });

  public readonly signedOutLabel = computed(() =>
    this.translation.translate('userSettings.notSignedIn')
  );

  public readonly rows: Signal<MenuItem[]> = computed(() =>
    this.userService.user() ? this.signedInRows() : this.signedOutRows()
  );

  private signedInRows(): MenuItem[] {
    return [
      {
        label: this.translation.translate('userSettings.account'),
        icon: 'ph ph-user',
        href: ACCOUNT_URL,
        target: '_blank'
      },
      {
        label: this.translation.translate('userSettings.logOut'),
        icon: 'ph ph-sign-out',
        command: () => void this.sessionLifecycle.requestLogout()
      }
    ];
  }

  private signedOutRows(): MenuItem[] {
    return [
      {
        label: this.translation.translate('userSettings.logIn'),
        icon: 'ph ph-sign-in',
        href: LOGIN_URL,
        target: '_blank'
      },
      {
        label: this.translation.translate('userSettings.signUp'),
        icon: 'ph ph-user-plus',
        href: REGISTER_URL,
        target: '_blank'
      }
    ];
  }
}
