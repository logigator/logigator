import type {
  Author,
  ComponentSummary,
  ForkAttribution,
  Page,
  ProjectSummary
} from '@logigator/contract';
import type { ComponentRow, ProjectRow, UserRow } from '../database/schema';
import { AVATAR_VARIANTS, variantUrls } from '../storage/image-variants';
import { previewUrls } from '../storage/image-variants';
import type { AncestorRow, CircuitRow } from './circuit-queries';

/**
 * Rows as clients read them.
 *
 * Every mapper here is total and explicit, which is the point: there are no
 * serialization groups and no class-level `@Exclude`, so a column is in a
 * response because somebody wrote it there. The legacy backend's defence
 * against leaking an internal field was a decorator you had to remember; here it
 * is that the response shape is a separate thing from the row.
 */
function circuitFields(row: CircuitRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    public: row.public,
    link: row.link,
    version: row.version,
    componentCount: row.componentCount,
    wireCount: row.wireCount,
    preview: row.previewId ? previewUrls(row.previewId) : null,
    createdAt: row.createdAt.toISOString(),
    lastEditedAt: row.lastEditedAt.toISOString()
  };
}

export function toProjectSummary(row: ProjectRow): ProjectSummary {
  return circuitFields(row);
}

export function toComponentSummary(row: ComponentRow): ComponentSummary {
  return {
    ...circuitFields(row),
    symbol: row.symbol,
    numInputs: row.numInputs,
    numOutputs: row.numOutputs,
    labels: row.labels
  };
}

/** Maps a page's rows while carrying its counts through unchanged. */
export function mapPage<TRow, TEntry>(
  page: Page<TRow>,
  map: (row: TRow) => TEntry
): Page<TEntry> {
  return { ...page, entries: page.entries.map(map) };
}

/**
 * Who owns a document. Deliberately not `UserResponse`: a public surface showing
 * somebody else's account is a different shape, not the account holder's own
 * with fields left out.
 */
export function toAuthor(
  user: Pick<UserRow, 'id' | 'username' | 'avatarId'>
): Author {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatarId
      ? variantUrls('profile', user.avatarId, AVATAR_VARIANTS)
      : null
  };
}

/**
 * The fork lineage in the exported file format's own field names — `projectId`
 * included, for what may well be a component.
 *
 * That spelling is frozen in `FileForkAttributionV1`, so re-spelling it here
 * would buy nothing but a mapping step in every client that writes a downloaded
 * cloud document back out to a file.
 */
export function toAttribution(
  chain: readonly AncestorRow[]
): ForkAttribution[] {
  return chain.map((ancestor) => ({
    projectId: ancestor.id,
    projectName: ancestor.name,
    authorName: ancestor.authorName
  }));
}
