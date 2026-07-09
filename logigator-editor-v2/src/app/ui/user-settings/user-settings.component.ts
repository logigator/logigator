import { Component, computed, inject, signal } from '@angular/core';
import { LgAvatar, LgDivider, LgMenu, LgRipple, MenuItem } from '@logigator/ui';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import { UserService } from '../../user/user.service';
import { SessionLifecycleService } from '../../user/session-lifecycle.service';
import { SettingsComponent } from '../../settings/settings.component';

@Component({
  selector: 'app-user-settings',
  imports: [
    LgAvatar,
    LgDivider,
    LgMenu,
    LgRipple,
    ThemeSwitcherComponent,
    LanguageSwitcherComponent,
    SettingsComponent
  ],
  templateUrl: './user-settings.component.html'
})
export class UserSettingsComponent {
  protected readonly userService = inject(UserService);
  private readonly sessionLifecycle = inject(SessionLifecycleService);
  protected readonly menuOpen = signal(false);

  protected readonly userImageUrl = computed(
    () => this.userService.user()?.image?.publicUrl ?? undefined
  );
  protected readonly userInitial = computed(
    () => this.userService.user()?.username.slice(0, 1).toUpperCase() ?? ''
  );

  protected readonly menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [{ separator: true }];

    if (this.userService.user()) {
      items.push({
        label: 'Account',
        icon: 'ph ph-user',
        command: () => this.userService.openAccountSettings()
      });
      items.push({
        label: 'Log Out',
        icon: 'ph ph-sign-out',
        command: () => void this.sessionLifecycle.requestLogout()
      });
    } else {
      items.push({
        label: 'Log In',
        icon: 'ph ph-sign-in',
        command: () => this.userService.login()
      });
    }

    return items;
  });
}
