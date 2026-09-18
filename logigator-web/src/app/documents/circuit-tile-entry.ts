import type {
  Author,
  CircuitPreview,
  CommunityComponent,
  CommunityProject
} from '@logigator/contract';

/** A community listing row, whichever of the two tables it came from. */
export type CommunityRow = CommunityProject | CommunityComponent;

/**
 * One tile, ready to draw. `meta` carries the author and the star count
 * together because they are suppressed together: a list where every row shares
 * an author says so once, in its heading.
 */
export interface CircuitTileEntry {
  id: string;
  name: string;
  href: string;
  /** Leaves the site: the editor is a separate deployment on this origin. */
  external: boolean;
  preview: CircuitPreview | null;
  meta: { author: Author; authorHref: string; stars: number } | null;
}

export interface TileEntryOptions<TRow extends CommunityRow> {
  href: (row: TRow) => string;
  /**
   * Where the author's own page is. Omitting it drops the whole meta row,
   * which is what a list whose rows all share an author wants.
   */
  authorHref?: (row: TRow) => string;
  external?: boolean;
}

export function toTileEntries<TRow extends CommunityRow>(
  rows: readonly TRow[],
  options: TileEntryOptions<TRow>
): CircuitTileEntry[] {
  const { authorHref } = options;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    href: options.href(row),
    external: options.external ?? false,
    preview: row.preview,
    meta: authorHref
      ? { author: row.author, authorHref: authorHref(row), stars: row.stars }
      : null
  }));
}
