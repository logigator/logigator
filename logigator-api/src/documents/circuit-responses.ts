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
 * Rows as clients read them. Every mapper is total and explicit — no
 * serialization groups, no class-level `@Exclude` — so a column is in a
 * response only because somebody wrote it there.
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

export function mapPage<TRow, TEntry>(
  page: Page<TRow>,
  map: (row: TRow) => TEntry
): Page<TEntry> {
  return { ...page, entries: page.entries.map(map) };
}

/**
 * Who owns a document. Not `UserResponse`: showing somebody else's account is
 * its own shape, not the account holder's with fields left out.
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
 * The fork lineage in the file format's own field names — `projectId` included,
 * for what may well be a component. That spelling is frozen in
 * `FileForkAttributionV1`; re-spelling it here would only add a mapping step
 * wherever a downloaded document is written back out to a file.
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
