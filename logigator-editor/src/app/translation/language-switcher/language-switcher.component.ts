import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgSelect } from '@logigator/ui';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { AnalyticsEvent } from '../../analytics/analytics.mapping';

@Component({
  selector: 'app-language-switcher',
  imports: [FormsModule, LgSelect],
  templateUrl: './language-switcher.component.html'
})
export class LanguageSwitcherComponent {
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  protected readonly currentLang = this.translation.activeLang;

  protected readonly langOptions = this.translation.getAvailableLangs();

  protected setLang(lang: string): void {
    this.translation.setActiveLang(lang);
    this.analytics.capture(AnalyticsEvent.SettingChanged, {
      setting: 'language',
      value: lang
    });
  }
}
