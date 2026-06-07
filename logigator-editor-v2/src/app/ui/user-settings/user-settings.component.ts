import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MenuModule } from 'primeng/menu';
import { Ripple } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import type { UserData } from '../../api/models/user';

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
  protected readonly menuOpen = signal(false);

  protected readonly currentUser = signal<UserData | null>(null);

  protected readonly isLoggedIn = computed(() => this.currentUser() !== null);
  protected readonly userImageUrl = computed(
    () => this.currentUser()?.image?.publicUrl ?? undefined
  );
  protected readonly userInitial = computed(
    () => this.currentUser()?.username.slice(0, 1).toUpperCase() ?? ''
  );

  protected readonly menuItems = computed<MenuItem[]>(() =>
    {
      const items: MenuItem[] = [
        {
          separator: true
        }
      ];

      if (this.isLoggedIn()) {
        items.push({
          label: 'Account',
          icon: 'ph ph-user',
          command: () => this.logout()
        });
        items.push({
          label: 'Log Out',
          icon: 'ph ph-sign-out',
          command: () => this.logout()
        });
      } else {
        items.push({
          label: 'Log In',
          icon: 'ph ph-sign-in',
          command: () => this.login()
        });
      }

      return items;
    }
  );

  protected logout(): void {
    // TODO
  }

  protected login(): void {
    // TODO
  }
}
