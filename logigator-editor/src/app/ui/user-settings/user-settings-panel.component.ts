import { Component, inject, output } from '@angular/core';
import { LgUserPanel } from '@logigator/ui';
import { UserMenuService } from './user-menu.service';
import { UserSettingsSectionsComponent } from './user-settings-sections.component';

/**
 * The account/settings panel as a surface of its own — the compact account
 * sheet. The title bar's control renders the same panel inside its menu.
 *
 * `action` fires after an account action so the hosting sheet can close; a
 * setting change doesn't, so toggling one keeps the panel open.
 */
@Component({
  selector: 'app-user-settings-panel',
  imports: [LgUserPanel, UserSettingsSectionsComponent],
  template: `
    <lg-user-panel
      [username]="userMenu.username()"
      [signedOutLabel]="userMenu.signedOutLabel()"
      [image]="userMenu.avatar()"
      [model]="userMenu.rows()"
      (action)="action.emit()"
    >
      <app-user-settings-sections />
    </lg-user-panel>
  `
})
export class UserSettingsPanelComponent {
  protected readonly userMenu = inject(UserMenuService);

  public readonly action = output<void>();
}
