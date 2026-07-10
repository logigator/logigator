import { Component, computed, inject, signal } from '@angular/core';
import { LgAvatar, LgMenu, LgRipple } from '@logigator/ui';
import { UserService } from '../../user/user.service';
import { UserSettingsPanelComponent } from './user-settings-panel.component';

/**
 * The title-bar avatar trigger: shows the signed-in user (or a placeholder)
 * and toggles a popover holding the account/settings panel.
 */
@Component({
  selector: 'app-user-settings',
  imports: [LgAvatar, LgMenu, LgRipple, UserSettingsPanelComponent],
  templateUrl: './user-settings.component.html'
})
export class UserSettingsComponent {
  protected readonly userService = inject(UserService);
  protected readonly menuOpen = signal(false);

  protected readonly userImageUrl = computed(
    () => this.userService.user()?.image?.publicUrl ?? undefined
  );
  protected readonly userInitial = computed(
    () => this.userService.user()?.username.slice(0, 1).toUpperCase() ?? ''
  );
}
