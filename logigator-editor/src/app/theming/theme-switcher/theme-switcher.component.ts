import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgSelectButton } from '@logigator/ui';
import { ThemingService } from '../theming.service';
import { ThemeType } from '../theme-type.enum';
import { TranslationService } from '../../translation/translation.service';

@Component({
  selector: 'app-theme-switcher',
  imports: [FormsModule, LgSelectButton],
  templateUrl: './theme-switcher.component.html'
})
export class ThemeSwitcherComponent {
  private readonly themingService = inject(ThemingService);
  private readonly translation = inject(TranslationService);

  protected readonly currentTheme = this.themingService.currentThemeType;

  // The labels re-translate on language change because `translate()` reads the
  // service's post-load signal, making this computed depend on it.
  protected readonly themeOptions = computed(() => [
    {
      label: this.translation.translate('theming.light'),
      icon: 'ph ph-sun',
      value: ThemeType.LIGHT
    },
    {
      label: this.translation.translate('theming.dark'),
      icon: 'ph ph-moon',
      value: ThemeType.DARK
    }
  ]);

  protected setTheme(theme: ThemeType): void {
    this.themingService.setTheme(theme);
  }
}
