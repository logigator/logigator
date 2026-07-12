import { Component, inject, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgDivider, LgRipple } from '@logigator/ui';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import { UserService } from '../../user/user.service';
import { SessionLifecycleService } from '../../user/session-lifecycle.service';
import { SettingsComponent } from '../../settings/settings.component';
import { UserAvatarComponent } from './user-avatar.component';

/**
 * The account/settings panel: avatar header, theme/language/editor-settings
 * sections and the account actions (log in/out, account page). `action` fires
 * after an account action runs so a hosting overlay can dismiss itself; the
 * switcher sections don't fire it — toggling a setting keeps the panel open.
 */
@Component({
  selector: 'app-user-settings-panel',
  imports: [
    TranslocoDirective,
    LgDivider,
    LgRipple,
    ThemeSwitcherComponent,
    LanguageSwitcherComponent,
    SettingsComponent,
    UserAvatarComponent
  ],
  templateUrl: './user-settings-panel.component.html'
})
export class UserSettingsPanelComponent {
  protected readonly userService = inject(UserService);
  private readonly sessionLifecycle = inject(SessionLifecycleService);

  public readonly action = output<void>();

  protected openAccountSettings(): void {
    this.userService.openAccountSettings();
    this.action.emit();
  }

  protected logout(): void {
    void this.sessionLifecycle.requestLogout();
    this.action.emit();
  }

  protected login(): void {
    this.userService.login();
    this.action.emit();
  }
}
