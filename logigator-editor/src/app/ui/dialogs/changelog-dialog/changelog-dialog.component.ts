import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangelogRelease, releaseInstant } from '@logigator/docs';
import { LgButton, LgDialogContent, LgMarkdown } from '@logigator/ui';
import { ChangelogService } from '../../../changelog/changelog.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';

/**
 * "What's new" dialog, also opened automatically on the first load of a new
 * release. Renders the releases and records the newest version as seen, so
 * the auto-open no longer fires for it.
 *
 * Each release heading is drawn the way the site's changelog page draws it
 * (version, then the date written out in the active language), stacked above
 * the notes because the dialog is too narrow for the page's side column.
 */
@Component({
  selector: 'app-changelog-dialog',
  imports: [LgButton, LgMarkdown, TranslateDirective],
  templateUrl: './changelog-dialog.component.html'
})
export class ChangelogDialogComponent extends LgDialogContent {
  private readonly changelog = inject(ChangelogService);
  private readonly translation = inject(TranslationService);

  private readonly loaded = signal<ChangelogRelease[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly releases = computed(() => {
    const releases = this.loaded();
    if (!releases) {
      return null;
    }
    const format = new Intl.DateTimeFormat(this.translation.activeLang(), {
      dateStyle: 'long',
      timeZone: 'UTC'
    });
    return releases.map((release) => ({
      ...release,
      dateLabel: format.format(new Date(releaseInstant(release.date)))
    }));
  });

  constructor() {
    super();
    // Opening the dialog at all — including manually — counts as seeing the
    // release, so the auto-open no longer fires for it.
    this.changelog.acknowledge();
    this.changelog
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (releases) => this.loaded.set(releases),
        error: () => this.failed.set(true)
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
