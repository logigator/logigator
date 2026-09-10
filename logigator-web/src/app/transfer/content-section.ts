import { computed, inject, makeStateKey, signal, Signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { genericFailureKey } from '../forms/api-failure';
import { TranslationKey } from '../translation/translation-key.model';
import { TransferHandoffService } from './transfer-handoff.service';

/**
 * The failure travels as a translation key rather than as the error: it has to
 * cross the server/browser boundary as JSON, and the API's own message is
 * English on a four-language site.
 */
type SectionResult<TRow> =
  { entries: readonly TRow[]; total: number } | { failureKey: TranslationKey };

/** `entries` is empty for a working API with nothing published, `null` for a
 * read that failed. */
export interface ContentSection<TRow> {
  readonly entries: Signal<readonly TRow[] | null>;
  /**
   * How many rows match, not how many this page holds — every listing envelope
   * counts the whole match, which is what a paginator needs and what the home
   * page states as the community's size. `null` for a read that failed.
   */
  readonly total: Signal<number | null>;
  readonly failureKey: Signal<TranslationKey | null>;
  readonly retrying: Signal<boolean>;
  resolve(): Promise<void>;
  retry(): Promise<void>;
}

/**
 * One listing a page resolves before it activates, so the server render carries
 * the rows in its first byte and the browser reads them out of the document.
 *
 * A read that fails resolves to a value rather than rejecting. Rejecting would
 * transfer nothing, so hydration would silently repeat a request that has
 * already failed once — and the section could not tell an empty list from a
 * broken one.
 *
 * Call from an injection context: the hand-off is injected here rather than
 * passed, so a page's service reads as a list of its sections.
 *
 * @param name the hand-off key, unique across the site.
 */
export function contentSection<TRow>(
  name: string,
  read: () => Observable<{ entries: TRow[]; total: number }>
): ContentSection<TRow> {
  const handoff = inject(TransferHandoffService);
  const key = makeStateKey<SectionResult<TRow>>(name);
  const result = signal<SectionResult<TRow>>({ entries: [], total: 0 });
  const retrying = signal(false);

  const fetch = async (): Promise<SectionResult<TRow>> => {
    try {
      const { entries, total } = await firstValueFrom(read());
      return { entries, total };
    } catch (error) {
      return { failureKey: genericFailureKey(error) };
    }
  };

  return {
    entries: computed(() => {
      const current = result();
      return 'entries' in current ? current.entries : null;
    }),
    total: computed(() => {
      const current = result();
      return 'total' in current ? current.total : null;
    }),
    failureKey: computed(() => {
      const current = result();
      return 'failureKey' in current ? current.failureKey : null;
    }),
    retrying: retrying.asReadonly(),
    resolve: async () => {
      result.set(await handoff.resolve(key, fetch));
    },
    // Not through the hand-off: what it holds is the answer that failed.
    retry: async () => {
      retrying.set(true);
      try {
        result.set(await fetch());
      } finally {
        retrying.set(false);
      }
    }
  };
}
