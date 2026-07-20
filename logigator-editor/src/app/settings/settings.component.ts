import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgToggleSwitch } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { EditorSettingsService } from './editor-settings.service';
import { EditorSetting } from './editor-setting';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/** Renders an on/off toggle for every setting in `EditorSettingsService`. */
@Component({
  selector: 'app-settings',
  imports: [FormsModule, LgToggleSwitch, TranslocoDirective],
  templateUrl: './settings.component.html'
})
export class SettingsComponent {
  protected readonly editorSettings = inject(EditorSettingsService);
  protected readonly onboarding = inject(OnboardingService);
  private readonly analytics = inject(AnalyticsService);

  protected setSetting(setting: EditorSetting, value: boolean): void {
    setting.set(value);
    this.analytics.capture(AnalyticsEvent.SettingChanged, {
      setting: setting.key,
      value
    });
  }

  protected setTipsEnabled(value: boolean): void {
    this.onboarding.setTipsEnabled(value);
    this.analytics.capture(AnalyticsEvent.SettingChanged, {
      setting: 'onboardingTips',
      value
    });
  }
}
