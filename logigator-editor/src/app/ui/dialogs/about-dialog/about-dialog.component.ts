import { Component } from '@angular/core';
import { LgButton, LgDialogContent } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';
import { LocalDatePipe } from '../../../utils/local-date/local-date.pipe';

/**
 * Informational About dialog reached from the Help menu: app version (with the
 * build-time commit and date when stamped), the source repository, license and
 * copyright, and links to the legal pages on logigator.com. Carries no data or
 * result — dismissing simply closes it.
 */
@Component({
  selector: 'app-about-dialog',
  imports: [LgButton, LocalDatePipe, TranslocoDirective],
  templateUrl: './about-dialog.component.html'
})
export class AboutDialogComponent extends LgDialogContent {
  protected readonly version = environment.version;
  protected readonly commit = environment.buildCommit;
  protected readonly buildDate = environment.buildDate;

  /** End year of the copyright range; the build year when stamped. */
  protected readonly year = (this.buildDate ?? new Date())
    .getFullYear()
    .toString();

  protected readonly links = {
    repository: 'https://github.com/logigator/logigator',
    license: 'https://github.com/logigator/logigator/blob/master/LICENSE',
    privacyPolicy: 'https://logigator.com/privacy-policy',
    imprint: 'https://logigator.com/imprint'
  };

  protected close(): void {
    this.dialogRef.close();
  }
}
