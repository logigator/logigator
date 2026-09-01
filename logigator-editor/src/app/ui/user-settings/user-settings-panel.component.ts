import { Component, inject, output } from '@angular/core';
import { LgDivider, LgRipple } from '@logigator/ui';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import { UserService } from '../../user/user.service';
import { SessionLifecycleService } from '../../user/session-lifecycle.service';
import { SettingsComponent } from '../../settings/settings.component';
import { UserAvatarComponent } from './user-avatar.component';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * The account/settings panel: avatar header, the theme/language/editor-settings
 * sections and the account actions. `action` fires after an account action so a
 * hosting overlay can dismiss itself; the switcher sections don't fire it, so
 * toggling a setting keeps the panel open.
 */
@Component({
  selector: 'app-user-settings-panel',
  imports: [
    TranslateDirective,
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

  protected register(): void {
    this.userService.register();
    this.action.emit();
  }
}
