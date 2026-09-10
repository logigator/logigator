import { computed, inject, Injectable, Signal } from '@angular/core';
import type { MenuItem } from '@logigator/ui';
import { UserService } from '../../user/user.service';
import { SessionLifecycleService } from '../../user/session-lifecycle.service';
import { TranslationService } from '../../translation/translation.service';

/**
 * The user panel's model — who is signed in, and the account action rows —
 * defined once for the title bar's control and the compact sheet that renders
 * the panel on its own.
 *
 * The rows are rebuilt whenever the active language changes, as every other
 * menu model is: `translate()` reads the post-load signal.
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
        command: () => this.userService.openAccountSettings()
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
        command: () => this.userService.login()
      },
      {
        label: this.translation.translate('userSettings.signUp'),
        icon: 'ph ph-user-plus',
        command: () => this.userService.register()
      }
    ];
  }
}
