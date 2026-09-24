import { Component, inject } from '@angular/core';
import { LgUserControl } from '@logigator/ui';
import { UserMenuService } from './user-menu.service';
import { UserSettingsSectionsComponent } from './user-settings-sections.component';

/**
 * The title-bar account control: the shared trigger and panel, filled with the
 * editor's sections and account rows.
 */
@Component({
  selector: 'app-user-settings',
  imports: [LgUserControl, UserSettingsSectionsComponent],
  template: `
    <lg-user-control
      [username]="userMenu.username()"
      [signedOutLabel]="userMenu.signedOutLabel()"
      [image]="userMenu.avatar()"
      [model]="userMenu.rows()"
    >
      <ng-template #sections>
        <app-user-settings-sections />
      </ng-template>
    </lg-user-control>
  `
})
export class UserSettingsComponent {
  protected readonly userMenu = inject(UserMenuService);
}
