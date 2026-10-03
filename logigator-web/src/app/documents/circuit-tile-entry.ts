import type {
  Author,
  CircuitPreview,
  CommunityComponent,
  CommunityProject
} from '@logigator/contract';

/** A community listing row, whichever of the two tables it came from. */
export type CommunityRow = CommunityProject | CommunityComponent;

/** Who a tile names, and where their page is — the fields the tile draws. */
export interface TileAuthor {
  username: string;
  avatar: Author['avatar'];
  href: string;
}

/**
 * One tile, ready to draw. `meta` is the row under the preview: the star count,
 * and the author where the list names one.
 *
 * The author is optional *within* the row rather than the row being optional
 * with it. A list whose rows all share an author says so once, in its heading —
 * but the tally stays, because what each circuit collected is the number a
 * member came to their own page to see. `meta` itself is null only where a list
 * wants no row at all.
 */
export interface CircuitTileEntry {
  id: string;
  name: string;
  href: string;
  /** Leaves the site: the editor is a separate deployment on this origin. */
  external: boolean;
  preview: CircuitPreview | null;
  meta: { author: TileAuthor | null; stars: number } | null;
}

export interface TileEntryOptions<TRow extends CommunityRow> {
  href: (row: TRow) => string;
  /**
   * Where the author's own page is. Omitting it drops the author from the meta
   * row and leaves the star count standing alone — the shape a list whose rows
   * all share an author wants.
   */
  authorHref?: (row: TRow) => string;
  /**
   * Whether the tiles carry a meta row at all. False for a list that is nobody's
   * particular work: the home page's examples belong to one account and are
   * curated, and a tally beside them would invite a comparison that is not
   * there.
   */
  meta?: boolean;
  external?: boolean;
}

export function toTileEntries<TRow extends CommunityRow>(
  rows: readonly TRow[],
  options: TileEntryOptions<TRow>
): CircuitTileEntry[] {
  const { authorHref, meta = true } = options;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    href: options.href(row),
    external: options.external ?? false,
    preview: row.preview,
    meta: meta
      ? {
          author: authorHref
            ? {
                username: row.author.username,
                avatar: row.author.avatar,
                href: authorHref(row)
              }
            : null,
          stars: row.stars
        }
      : null
  }));
}
