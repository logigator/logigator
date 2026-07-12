import { Component, inject } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { BugReportService } from './bug-report.service';

/**
 * Small floating action button that opens the bug-report dialog. Placed in the
 * board's bottom-right corner above the minimap by the app shell.
 */
@Component({
  selector: 'app-bug-report-badge',
  imports: [LgButton, LgTooltip, TranslocoDirective],
  host: { class: 'contents' },
  template: `<div
    *transloco="let t"
    class="rounded-full bg-content p-1.5 shadow-lg"
  >
    <lg-button
      icon="ph ph-bug"
      severity="secondary"
      rounded
      [lgTooltip]="t('bugReport.badgeTooltip')"
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
