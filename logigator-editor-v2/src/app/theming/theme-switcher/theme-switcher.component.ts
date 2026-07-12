import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { LgSelectButton } from '@logigator/ui';
import { ThemingService } from '../theming.service';
import { ThemeType } from '../theme-type.enum';

@Component({
  selector: 'app-theme-switcher',
  imports: [FormsModule, LgSelectButton],
  templateUrl: './theme-switcher.component.html'
})
export class ThemeSwitcherComponent {
  private readonly themingService = inject(ThemingService);
  private readonly transloco = inject(TranslocoService);

  protected readonly currentTheme = this.themingService.currentThemeType;

  protected readonly themeOptions = computed(() => {
    // Re-translate the labels when the active language changes.
    this.transloco.activeLang();
    return [
      {
        label: this.transloco.translate('theming.light'),
        icon: 'ph ph-sun',
        value: ThemeType.LIGHT
      },
      {
        label: this.transloco.translate('theming.dark'),
        icon: 'ph ph-moon',
        value: ThemeType.DARK
      }
    ];
  });

  protected setTheme(theme: ThemeType): void {
    this.themingService.setTheme(theme);
  }
}
