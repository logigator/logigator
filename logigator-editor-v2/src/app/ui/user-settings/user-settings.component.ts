import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MenuModule } from 'primeng/menu';
import { Ripple } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import { UserService } from '../../user/user.service';

@Component({
  selector: 'app-user-settings',
  imports: [
    AvatarModule,
    DividerModule,
    MenuModule,
    Ripple,
    ThemeSwitcherComponent,
    LanguageSwitcherComponent
  ],
  templateUrl: './user-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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
        command: () => this.userService.logout()
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
