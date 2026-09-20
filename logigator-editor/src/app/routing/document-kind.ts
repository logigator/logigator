import type { LgCommunityKind, LgDocumentKind } from '@logigator/ui';

/**
 * The two spellings a document's kind has here, and the one place that knows
 * both. `@logigator/ui` keeps them as two types on purpose — the **route's**
 * plural names a section (`projects | components`, the one a document's page
 * lives in) and the **API's** singular names a row of one table
 * (`project | component`) — so a call site handed the wrong one does not
 * compile, and somebody still has to choose. Choosing happens here rather than
 * at each of them: the share route reads the plural off its URL and the API
 * takes the singular, the share dialog holds the singular and builds the site's
 * page URL, and a second table in any of those would be a second thing to keep
 * in step with `/api/share/{kind}/{link}`.
 *
 * The one direction stated twice is the membership test the route needs before
 * it can trust a path segment; both live in this table, so a third kind is one
 * entry rather than a search for the places that spell them out.
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

/**
 * Whether a path segment names a kind at all. A route pattern matches any
 * segment, so `/share/nonsense/{link}` has to be turned away as not being a
 * route rather than loaded as one.
 *
 * Asked of the table's own keys rather than with `in`, which answers for
 * everything `Object.prototype` carries as well: `/share/toString/{link}` would
 * otherwise be a route, and the table would hand back a function to put in the
 * API's path.
 */
export function isRouteKind(value: string): value is LgCommunityKind {
  return Object.hasOwn(API_KIND_OF, value);
}
