import { computed, inject, Injectable, signal } from '@angular/core';
import type { ComponentSummary, ProjectSummary } from '@logigator/contract';
import type { CommunityKind } from '../../api/services/community-api.service';
import { DocumentsApiService } from '../../api/services/documents-api.service';
import { contentSection } from '../../transfer/content-section';
import { MY_PAGE_SIZE, MyListingQuery } from './my-listing-query';

/** A row on the reader's own shelf; a component carries its ports beside. */
export type MyDocumentRow = ProjectSummary | ComponentSummary;

/** What a metadata edit can change about a row without re-reading the page. */
export type MyDocumentPatch = Partial<
  Pick<MyDocumentRow, 'name' | 'description' | 'public' | 'link'>
>;

/**
 * One page of the reader's own projects or components.
 *
 * The listing is resolved by a guard, so a server render carries the tiles in
 * its first byte, and the query is read off the URL before the read — the same
 * rule the community browse pages follow, which is what makes a reload and the
 * back button answer the same rows.
 *
 * What a shelf adds is that its rows change under the reader. A metadata edit
 * is applied over the resolved page rather than re-read: the API answers with
 * the row it wrote, and re-fetching would also re-sort the grid under the
 * cursor, a rename bumping the edit time. A delete drops its row and takes one
 * off the total, so the count under the grid keeps saying what the grid shows.
 *
 * One hand-off key for both kinds: only one shelf renders per document, and
 * the key is consumed on hydration, so a later client-side navigation to the
 * other kind asks the API rather than replaying page load.
 */
@Injectable({ providedIn: 'root' })
export class MyDocumentsService {
  private readonly documentsApi = inject(DocumentsApiService);

  private readonly _kind = signal<CommunityKind>('projects');
  private readonly _query = signal<MyListingQuery>({ page: 0, search: '' });

  /** Edits made since the page was resolved, by row id. */
  private readonly patches = signal<ReadonlyMap<string, MyDocumentPatch>>(
    new Map()
  );
  private readonly removed = signal<ReadonlySet<string>>(new Set());

  public readonly kind = this._kind.asReadonly();
  public readonly query = this._query.asReadonly();

  private readonly listing = contentSection<MyDocumentRow>(
    'my.documents',
    () => {
      const { page, search } = this._query();
      const request = {
        page,
        size: MY_PAGE_SIZE,
        // Omitted rather than sent empty: the API treats an absent search as
        // "no filter", and an empty `search=` in the log is noise.
        ...(search ? { search } : {})
      };
      return this._kind() === 'projects'
        ? this.documentsApi.projects(request)
        : this.documentsApi.components(request);
    }
  );

  public readonly failureKey = this.listing.failureKey;
  public readonly retrying = this.listing.retrying;

  /** The page as it now stands: what was resolved, minus what was deleted,
   * with every edit since applied over it. */
  public readonly rows = computed(() => {
    const entries = this.listing.entries();
    if (!entries) return null;

    const patches = this.patches();
    const removed = this.removed();
    return entries
      .filter((row) => !removed.has(row.id))
      .map((row) => {
        const patch = patches.get(row.id);
        return patch ? { ...row, ...patch } : row;
      });
  });

  /** How many rows match, the deletions this page has seen taken off. */
  public readonly total = computed(() => {
    const total = this.listing.total();
    return total === null ? null : Math.max(0, total - this.removed().size);
  });

  /** How many pages the match spans, at least one so the control has a state. */
  public readonly pageCount = computed(() => {
    const total = this.total();
    return total === null ? 1 : Math.max(1, Math.ceil(total / MY_PAGE_SIZE));
  });

  public async resolve(
    kind: CommunityKind,
    query: MyListingQuery
  ): Promise<void> {
    this._kind.set(kind);
    this._query.set(query);
    this.patches.set(new Map());
    this.removed.set(new Set());
    await this.listing.resolve();
  }

  public retry(): Promise<void> {
    return this.listing.retry();
  }

  /** Records what a metadata write answered with, so the grid says it too. */
  public applyPatch(id: string, patch: MyDocumentPatch): void {
    this.patches.update((current) => {
      const next = new Map(current);
      next.set(id, { ...next.get(id), ...patch });
      return next;
    });
  }

  public dropRow(id: string): void {
    this.removed.update((current) => new Set(current).add(id));
  }
}
