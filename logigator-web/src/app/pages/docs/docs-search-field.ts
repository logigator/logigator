import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LgIconField, LgInputIcon, LgInputText } from '@logigator/ui';
import { debounceTime, Subject } from 'rxjs';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { DocsSearchService } from './docs-search.service';

/** Long enough that a URL is not rewritten mid-word. */
const URL_SYNC_MS = 300;

/**
 * The documentation search field.
 *
 * Two behaviours, one field. Where the results are on screen — the index page —
 * typing filters them and the URL follows, so the query is shareable and
 * survives a reload. Beside a page, where there is nowhere to put results,
 * it is a form: submitting goes to the index, which is where results live.
 */
@Component({
  selector: 'web-docs-search-field',
  imports: [LgIconField, LgInputIcon, LgInputText, TranslateDirective],
  templateUrl: './docs-search-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsSearchField {
  private readonly router = inject(Router);
  private readonly links = inject(SiteLinks);
  protected readonly search = inject(DocsSearchService);

  /** Whether the results are on this page, and the URL should follow along. */
  public readonly live = input(false);

  /** Where a submit goes, script or no script. */
  protected readonly indexHref = this.links.docs;

  private readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(debounceTime(URL_SYNC_MS), takeUntilDestroyed())
      .subscribe((query) => this.syncUrl(query));
  }

  protected onInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    // Set before the debounce either way: off the index page this is what
    // warms the index, so the results are there when the field is submitted.
    this.search.search(query);
    if (this.live()) {
      this.typed.next(query);
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.live()) {
      void this.router.navigate([this.indexHref()], {
        queryParams: { q: this.search.query() || null }
      });
    }
  }

  /** Replaces rather than pushes: typing is not a trail of history entries. */
  private syncUrl(query: string): void {
    void this.router.navigate([], {
      queryParams: { q: query || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
