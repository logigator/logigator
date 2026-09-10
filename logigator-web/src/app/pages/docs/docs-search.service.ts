import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageId } from '@logigator/core';
import { DocsIndex, DocsSearchHit, searchDocs } from '@logigator/docs';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { AnalyticsService } from '../../analytics/analytics.service';
import { TransferHandoffService } from '../../transfer/transfer-handoff.service';
import { TranslationService } from '../../translation/translation.service';
import { docsIndex } from './doc-index';

/** How long a query has to stand still before it is worth counting. */
const REPORT_AFTER_MS = 1200;
/** Below this a query is still being typed, and matches half the manual. */
const MIN_QUERY_LENGTH = 2;

/** The answer a server render resolved, until this browser can compute it. */
interface SeededHits {
  query: string;
  lang: LanguageId;
  hits: DocsSearchHit[];
}

/**
 * Full-text search over the documentation.
 *
 * The index is built out of the same per-language chunks the pages themselves
 * are — around 18 kB gzipped for all eleven, hashed and immutable, so it is
 * paid once and the page a result opens is already downloaded. A generated
 * index would be the same prose a second time in the repository, going stale
 * whenever the copy is edited.
 *
 * **A `?q=` render answers the query itself**, the way every other list on this
 * site is resolved by a guard: the first byte carries the results, so there is
 * no flash of the page's contents list, and the search works with no JavaScript
 * at all. The hits then cross to the browser through the hand-off, which is
 * what lets hydration draw the same rows while this side builds its own index
 * for the next keystroke.
 */
@Injectable({ providedIn: 'root' })
export class DocsSearchService {
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);
  private readonly handoff = inject(TransferHandoffService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly loaded = signal<{
    lang: LanguageId;
    index: DocsIndex;
  } | null>(null);
  private readonly seeded = signal<SeededHits | null>(null);
  private readonly _query = signal('');
  private readonly settled = new Subject<string>();

  /** What the field holds, verbatim. */
  public readonly query = computed(this._query);

  /** Whether results are what the page should be showing. */
  public readonly searching = computed(() => this._query().trim().length > 0);

  /** True while neither this side's index nor a resolved answer is in. */
  public readonly loading = computed(
    () => this.searching() && this.index() === null && this.seed() === null
  );

  /**
   * The results: computed here once the index is in, and until then whatever a
   * server render already worked out for this exact query.
   */
  public readonly hits = computed<DocsSearchHit[]>(() => {
    const index = this.index();
    if (index) {
      return searchDocs(index, this._query());
    }
    return this.seed()?.hits ?? [];
  });

  constructor() {
    // Counted once the typing stops: a per-keystroke event would report every
    // prefix of a word, and what is worth knowing is the query left standing —
    // above all the ones that found nothing.
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
   * search of a visit is typed while the chunks are still coming, and a query
   * counted before its answer arrived would be counted as having found
   * nothing — the one thing this event is here to tell apart. A chunk that
   * never loads leaves nothing to count, so nothing is reported.
   */
  private async report(query: string): Promise<void> {
    const loaded = await this.ensureIndex().catch(() => null);
    if (!loaded) {
      return;
    }
    this.analytics.capture('docs_searched', {
      query,
      results: searchDocs(loaded.index, query).length,
      language: loaded.lang
    });
  }

  /**
   * Answers `query` before the route activates: on the server by indexing and
   * searching, in the browser by taking the hits that render left behind. It
   * then warms this side's index, the page being one a reader types into next.
   */
  public async resolve(query: string): Promise<void> {
    this._query.set(query);
    if (query.trim().length === 0) {
      return;
    }
    const lang = this.translation.getActiveLang();
    const hits = await this.handoff.resolve(
      makeStateKey<DocsSearchHit[]>(`docs-search-${lang}-${query}`),
      async () => searchDocs(await docsIndex(lang), query)
    );
    this.seeded.set({ query, lang, hits });
    if (this.isBrowser) {
      void this.ensureIndex();
    }
  }

  /** Sets what is being searched for, loading the language's index if needed. */
  public search(query: string): void {
    this._query.set(query);
    const trimmed = query.trim();
    if (trimmed.length === 0 || !this.isBrowser) {
      return;
    }
    void this.ensureIndex();
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      this.settled.next(trimmed);
    }
  }

  /** The index for the language being read, or null while it is still coming. */
  private index(): DocsIndex | null {
    const loaded = this.loaded();
    return loaded?.lang === this.translation.activeLang() ? loaded.index : null;
  }

  /** The resolved answer, while it is still an answer to what is being asked. */
  private seed(): SeededHits | null {
    const seeded = this.seeded();
    return seeded?.query === this._query() &&
      seeded.lang === this.translation.activeLang()
      ? seeded
      : null;
  }

  private async ensureIndex(): Promise<{ lang: LanguageId; index: DocsIndex }> {
    const lang = this.translation.getActiveLang();
    const index = await docsIndex(lang);
    // The language can have changed while the chunks were in flight; the newer
    // one's own load is what will set it.
    if (this.translation.getActiveLang() === lang) {
      this.loaded.set({ lang, index });
    }
    return { lang, index };
  }
}
