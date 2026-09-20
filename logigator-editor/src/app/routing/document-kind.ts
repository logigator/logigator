import type { LgCommunityKind, LgDocumentKind } from '@logigator/ui';

/**
 * The two spellings a document's kind has here, and the one place that knows
 * both. `@logigator/ui` keeps them as two types on purpose — the **route's**
 * plural names a section (`projects | components`, the one a document's page
 * lives in) and the **API's** singular names a row of one table
 * (`project | component`) — so a call site handed the wrong one does not
 * compile, and somebody still has to choose. Choosing happens here rather than
 * at each of them: the share route's pattern names the plural and the API takes
 * the singular, the share dialog holds the singular and builds the site's page
 * URL, and a second table in any of those would be a second thing to keep in
 * step with `/api/share/{kind}/{link}`.
 *
 * Kinds are trusted here rather than tested: the route tree names its own
 * literally (`/share/projects/:linkId`, `/share/components/:linkId`), so a path
 * whose kind segment says anything else is matched by no pattern at all and
 * never reaches this table.
 */
const API_KIND_OF: Record<LgCommunityKind, LgDocumentKind> = {
  projects: 'project',
  components: 'component'
};

/** The API's spelling of a route's kind, for `/api/share/{kind}/{link}`. */
export function apiKindOf(kind: LgCommunityKind): LgDocumentKind {
  return API_KIND_OF[kind];
}

/** The route's spelling of a kind, for a URL a reader is handed. */
export function routeKindOf(kind: LgDocumentKind): LgCommunityKind {
  return kind === 'project' ? 'projects' : 'components';
}
