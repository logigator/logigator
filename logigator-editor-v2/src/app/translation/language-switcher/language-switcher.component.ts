import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { Select } from 'primeng/select';

@Component({
  selector: 'app-language-switcher',
  imports: [FormsModule, Select],
  templateUrl: './language-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  private readonly translocoService = inject(TranslocoService);

  protected readonly currentLang = this.translocoService.activeLang;

  protected readonly langOptions = this.translocoService.getAvailableLangs();

  protected setLang(lang: string): void {
    this.translocoService.setActiveLang(lang);
  }
}
