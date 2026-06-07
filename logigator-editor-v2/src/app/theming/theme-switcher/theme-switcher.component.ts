import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ThemingService } from '../theming.service';
import { ThemeType } from '../theme-type.enum';

@Component({
  selector: 'app-theme-switcher',
  imports: [FormsModule, SelectButtonModule],
  templateUrl: './theme-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSwitcherComponent {
  private readonly themingService = inject(ThemingService);

  protected readonly currentTheme = this.themingService.currentThemeType;

  protected readonly themeOptions = [
    { label: 'Light', icon: 'ph ph-sun', value: ThemeType.LIGHT },
    { label: 'Dark', icon: 'ph ph-moon', value: ThemeType.DARK }
  ];

  protected setTheme(theme: ThemeType): void {
    this.themingService.setTheme(theme);
  }
}
