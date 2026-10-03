import { Component } from '@angular/core';
import { LgUserPanelSection } from '@logigator/ui';
import { ThemeSwitcherComponent } from '../../theming/theme-switcher/theme-switcher.component';
import { LanguageSwitcherComponent } from '../../translation/language-switcher/language-switcher.component';
import { SettingsComponent } from '../../settings/settings.component';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * The settings sections of the user panel. Projected rather than owned by the
 * panel: the editor-settings group is the editor's alone, and the website's
 * language control is links where this one is a switcher.
 */
@Component({
  selector: 'app-user-settings-sections',
  imports: [
    TranslateDirective,
    LgUserPanelSection,
    ThemeSwitcherComponent,
    LanguageSwitcherComponent,
    SettingsComponent
  ],
  host: { class: 'contents' },
  templateUrl: './user-settings-sections.component.html'
})
export class UserSettingsSectionsComponent {}
