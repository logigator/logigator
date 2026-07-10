import { Component, computed, inject } from '@angular/core';
import {
  LgDivider,
  LgPanelMenu,
  MenuItem,
  MenuItemCommandEvent
} from '@logigator/ui';
import { EditorMenuService } from '../editor-menu.service';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { UserSettingsPanelComponent } from '../user-settings/user-settings-panel.component';

/**
 * Content of the compact menu sheet: the curated flat action list on top (the
 * frequent tasks stay above the fold) and the account/settings panel below it.
 * Every action also dismisses the sheet, so a dialog it opens lands on an
 * uncovered board.
 */
@Component({
  selector: 'app-mobile-menu',
  imports: [LgPanelMenu, LgDivider, UserSettingsPanelComponent],
  template: `
    <lg-panel-menu [model]="items()"></lg-panel-menu>
    <lg-divider class="mt-2" variant="double" />
    <app-user-settings-panel (action)="mobileUi.close()" />
  `
})
export class MobileMenuComponent {
  protected readonly mobileUi = inject(MobileUiService);
  private readonly editorMenu = inject(EditorMenuService);

  protected readonly items = computed(() =>
    this.withSheetClose(this.editorMenu.compactItems())
  );

  /** Clones the model so every leaf command also closes the sheet. */
  private withSheetClose(items: MenuItem[]): MenuItem[] {
    return items.map((item) => ({
      ...item,
      items: item.items && this.withSheetClose(item.items),
      command:
        item.command &&
        ((event: MenuItemCommandEvent) => {
          this.mobileUi.close();
          item.command!(event);
        })
    }));
  }
}
