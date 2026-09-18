import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LgButton, LgDialogContent, LgMarkdown } from '@logigator/ui';
import { ChangelogService } from '../../../changelog/changelog.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * "What's new" dialog, also opened automatically on the first load of a new
 * release. Renders the changelog markdown and records the newest version as
 * seen, so the auto-open no longer fires for it.
 */
@Component({
  selector: 'app-changelog-dialog',
  imports: [LgButton, LgMarkdown, TranslateDirective],
  templateUrl: './changelog-dialog.component.html'
})
export class ChangelogDialogComponent extends LgDialogContent {
  private readonly changelog = inject(ChangelogService);

  protected readonly markdown = signal<string | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    super();
    // Opening the dialog at all — including manually — counts as seeing the
    // release, so the auto-open no longer fires for it.
    this.changelog.acknowledge();
    this.changelog
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (md) => this.markdown.set(md),
        error: () => this.failed.set(true)
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
