import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { headingSlug } from '@logigator/ui';
import {
  buildDocsIndex,
  DOC_PAGE_IDS,
  DocsIndex,
  DocsSearchEntry,
  DocsSearchHit,
  searchDocs
} from '@logigator/docs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  Subject
} from 'rxjs';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { TranslationService } from '../translation/translation.service';
import { docPageUrl } from './docs-pages';

/** How long a query has to stand still before it is worth counting. */
const REPORT_AFTER_MS = 1200;
/** Below this a query is still being typed, and matches half the manual. */
const MIN_QUERY_LENGTH = 2;

/**
 * Full-text search over the documentation, for the viewer's search field.
 *
 * The index is built in the browser out of the same markdown the pages
 * themselves are, fetched in one burst the first time a language is searched:
 * every page is a hashed URL, so the burst is paid once per visitor and the
 * pages opened from a result are already in the cache. A generated index would
 * be the same prose a second time, in the repository, going stale whenever the
 * copy is edited.
 */
@Injectable({ providedIn: 'root' })
export class DocsSearchService {
  private readonly http = inject(HttpClient);
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  private readonly indexes = new Map<string, Promise<DocsIndex>>();
  private readonly loaded = signal<{ lang: string; index: DocsIndex } | null>(
    null
  );
  private readonly _query = signal('');
  private readonly settled = new Subject<string>();

  /** What the field holds, verbatim. */
  public readonly query = computed(this._query);
  /** Whether the results are what the viewer should be showing. */
  public readonly searching = computed(() => this._query().trim().length > 0);
  /** True until the language's markdown is in; the field works regardless. */
  public readonly loading = computed(
    () => this.searching() && this.index() === null
  );

  public readonly hits = computed<DocsSearchHit[]>(() => {
    const index = this.index();
    return index ? searchDocs(index, this._query()) : [];
  });

  constructor() {
    // Counted once the typing stops: a per-keystroke event would report every
    // prefix of a word, and what is worth knowing is the query that was left
    // standing — above all the ones that found nothing.
    this.settled
      .pipe(
        debounceTime(REPORT_AFTER_MS),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((query) => void this.report(query));
  }

  /**
   * Counts one settled query, against the index that answers it: the first
   * search of a session is typed while eleven pages are still being fetched,
   * and a query counted before its answer arrived would be counted as having
   * found nothing — the one thing this event is here to tell apart.
   */
  private async report(query: string): Promise<void> {
    const { lang, index } = await this.ensureIndex();
    this.analytics.capture(AnalyticsEvent.DocsSearched, {
      query,
      results: searchDocs(index, query).length,
      language: lang
    });
  }

  /** Sets what is being searched for, loading the language's index if needed. */
  public search(query: string): void {
    this._query.set(query);
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return;
    }
    void this.ensureIndex();
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      this.settled.next(trimmed);
    }
  }

  public clear(): void {
    this._query.set('');
  }

  /** The index for the language being read, or null while it is still coming. */
  private index(): DocsIndex | null {
    const loaded = this.loaded();
    return loaded?.lang === this.translation.activeLang() ? loaded.index : null;
  }

  private async ensureIndex(): Promise<{ lang: string; index: DocsIndex }> {
    const lang = this.translation.getActiveLang();
    let pending = this.indexes.get(lang);
    if (!pending) {
      pending = this.fetchIndex(lang);
      this.indexes.set(lang, pending);
    }
    const index = await pending;
    // The language can have changed while the burst was in flight; the newer
    // one's own load is what will set it.
    if (this.translation.getActiveLang() === lang) {
      this.loaded.set({ lang, index });
    }
    return { lang, index };
  }

  /**
   * Every page of one language, as text. A page that fails to load is left out
   * rather than failing the burst: search over ten pages beats none.
   */
  private fetchIndex(lang: string): Promise<DocsIndex> {
    const pages = DOC_PAGE_IDS.map((page) =>
      this.http.get(docPageUrl(page, lang), { responseType: 'text' }).pipe(
        map((markdown): DocsSearchEntry | null => ({ page, markdown })),
        catchError(() => of(null))
      )
    );
    return new Promise((resolve) => {
      forkJoin(pages).subscribe((entries) =>
        resolve(
          buildDocsIndex(
            entries.filter((entry) => entry !== null),
            headingSlug
          )
        )
      );
    });
  }
}
