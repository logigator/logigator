import { Component, inject } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { BugReportService } from './bug-report.service';
import { TranslateDirective } from '../translation/translate.directive';

/** Floating action button that opens the bug-report dialog. */
@Component({
  selector: 'app-bug-report-badge',
  imports: [LgButton, LgTooltip, TranslateDirective],
  host: { class: 'contents' },
  template: `<div
    *appTranslate="let t"
    class="rounded-full bg-content p-1.5 shadow-lg"
  >
    <lg-button
      icon="ph ph-bug"
      severity="secondary"
      rounded
      [lgTooltip]="t('bugReport.badgeTooltip')"
      [ariaLabel]="t('bugReport.badgeTooltip')"
      tooltipPosition="left"
      (onClick)="report()"
    />
  </div>`
})
export class BugReportBadgeComponent {
  private readonly bugReport = inject(BugReportService);

  protected report(): void {
    this.bugReport.openManualReport();
  }
}
