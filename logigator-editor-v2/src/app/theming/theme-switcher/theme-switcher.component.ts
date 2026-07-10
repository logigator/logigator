import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

  protected readonly activeThemeId = computed(
    () => this.themingService.activeTheme().id
  );
  protected readonly currentVariant = this.themingService.currentThemeType;

  protected readonly themeOptions = this.themingService.themes.map((theme) => ({
    label: theme.label,
    value: theme.id
  }));

  protected readonly variantOptions = [
    { label: 'Dark', icon: 'ph ph-moon', value: ThemeType.DARK },
    { label: 'Light', icon: 'ph ph-sun', value: ThemeType.LIGHT }
  ];

  protected setTheme(id: string): void {
    this.themingService.setTheme(id);
  }

  protected setVariant(variant: ThemeType): void {
    this.themingService.setVariant(variant);
  }
}
