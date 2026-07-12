import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgMenu, LgRipple } from '@logigator/ui';
import { UserService } from '../../user/user.service';
import { UserSettingsPanelComponent } from './user-settings-panel.component';
import { UserAvatarComponent } from './user-avatar.component';

/**
 * The title-bar avatar trigger: shows the signed-in user (or a placeholder)
 * and toggles a popover holding the account/settings panel.
 */
@Component({
  selector: 'app-user-settings',
  imports: [
    TranslocoDirective,
    LgMenu,
    LgRipple,
    UserSettingsPanelComponent,
    UserAvatarComponent
  ],
  templateUrl: './user-settings.component.html'
})
export class UserSettingsComponent {
  protected readonly userService = inject(UserService);
  protected readonly menuOpen = signal(false);
}
