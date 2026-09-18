import { CommunityKind } from './app/api/services/community-api.service';

/**
 * Where every legacy URL went. The structural freedom Phase 5 took was bought
 * with this map: a route may move or merge, but no address that was ever in an
 * inbox, a bookmark or someone else's link may stop resolving.
 *
 * It lives in the app's own server rather than in Caddy because it changes with
 * the app's routes and therefore has to deploy with them.
 *
 * Paths here are **unprefixed**. The language segment is stripped before a
 * lookup and put back on the answer, so one entry covers all five forms of a
 * legacy URL — the bare one and the four localized ones.
 */

/** A segment the legacy app generated: a uuid, for every id and every link. */
const TOKEN = '[A-Za-z0-9-]+';

/** The legacy path of a page that simply moved, in whole. */
const MOVED: ReadonlyMap<string, string> = new Map([
  // The features page comes back as a tour with the capture harness; until then
  // what it advertised is the home page's own bands.
  ['/features', '/'],
  // Dropped outright: the page already said the desktop version was gone, and
  // it returns with the Electron app rather than as a port of itself.
  ['/download', '/'],
  // The Electron sign-in page was the same form with no chrome around it.
  ['/login-electron', '/login'],
  // The account is one page of sections now rather than three pages.
  ['/my/account/profile', '/my/account'],
  ['/my/account/security', '/my/account'],
  ['/my/account/delete', '/my/account']
]);

/**
 * One rule: the legacy path it matches, and the new path its captures build.
 * Ordered, first match wins, so a longer path is listed before the prefix of it.
 *
 * `to` is handed the query as well as the captures, because one legacy URL —
 * the member page, whose four tabs were a `?tab=` and are routes now — puts a
 * query parameter into the path it answers with.
 */
interface RedirectRule {
  readonly pattern: RegExp;
  readonly to: (groups: readonly string[], query: URLSearchParams) => string;
}

const RULES: readonly RedirectRule[] = [
  // The two tables were singular in the path and are plural now, matching the
  // API's own naming. `/page` was the partial the infinite scroll fetched; it
  // was never a page a visitor could be on, but it was a URL.
  {
    pattern: new RegExp(
      `^/community/(project|component)/(${TOKEN})/stargazers(?:/page)?$`
    ),
    to: ([kind, link]) => `/community/${plural(kind)}/${link}/stargazers`
  },
  {
    pattern: new RegExp(`^/community/(project|component)/(${TOKEN})$`),
    to: ([kind, link]) => `/community/${plural(kind)}/${link}`
  },
  // Starring and cloning were GETs that wrote, which is why neither survived as
  // a URL. Both land on the document they named: the page carries the controls.
  {
    pattern: new RegExp(
      `^/community/(?:toggleStar|clone)/(project|component)/(${TOKEN})$`
    ),
    to: ([kind, link]) => `/community/${plural(kind)}/${link}`
  },
  {
    pattern: /^\/community\/(projects|components)\/page$/,
    to: ([kind]) => `/community/${kind}`
  },
  // A member's four listings were one page with a `?tab=`; each is a route of
  // its own now, so the tab is read here and becomes part of the path.
  {
    pattern: new RegExp(`^/community/user/(${TOKEN})(?:/page)?$`),
    to: ([id], query) =>
      `/community/users/${id}${PROFILE_TABS[query.get('tab') ?? ''] ?? ''}`
  },
  // The legacy `/auth/*` entry points, which were GETs that started or ended a
  // sign-in. None has a successor on this origin — the API owns the OAuth round
  // trip now, and Twitter sign-in is gone — so they land on the page that offers
  // whatever sign-in methods the deployment actually has.
  {
    pattern: /^\/auth\/(?:logout|(?:google|twitter)-(?:login|authenticate))$/,
    to: () => '/login'
  },
  // Every popup was a URL the page fetched its markup from, and every one of
  // them belonged to a shelf. The shelf is where they all end up.
  {
    pattern: new RegExp(
      `^/my/(projects|components)/(?:page|create-popup|(?:info|edit-popup|delete-popup|share-popup)/${TOKEN})$`
    ),
    to: ([kind]) => `/my/${kind}`
  }
];

/** The tab a legacy profile URL named, as the section path it is now. */
const PROFILE_TABS: Record<string, string> = {
  projects: '',
  components: '/components',
  // One `r`, as the legacy validator spelled it. The links the legacy page drew
  // had the two swapped; the values it accepted are what an address bar holds.
  staredProjects: '/starred/projects',
  staredComponents: '/starred/components'
};

/**
 * The successor of a legacy path, with its query rewritten, or `null` for a
 * path this map does not name — which is every path that still exists.
 *
 * Both arguments and the result are unprefixed. The caller re-prefixes with the
 * language the request carried, and a request that carried none is answered
 * unprefixed too, so the language redirect below it negotiates one: two hops,
 * each with the status that is true of it, rather than a `301` whose target
 * depends on who asked.
 */
export function legacyRedirect(
  pathname: string,
  query: URLSearchParams
): string | null {
  const path = matchPath(pathname, query);
  if (path === null) {
    return null;
  }
  const params = rewriteQuery(query);
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

function matchPath(pathname: string, query: URLSearchParams): string | null {
  const moved = MOVED.get(pathname);
  if (moved) {
    return moved;
  }
  for (const rule of RULES) {
    const match = rule.pattern.exec(pathname);
    if (match) {
      return rule.to(match.slice(1), query);
    }
  }
  return null;
}

/**
 * The query a listing keeps. `search` and `orderBy=latest` mean the same thing
 * on both sides; `page` does not — it counted from zero in the legacy URLs and
 * counts from one here, a first page called `0` not being something to explain
 * to whoever reads the address bar.
 *
 * `tab` is dropped: it is part of the path now. Everything else goes too — a
 * parameter the new pages do not read would only survive as noise in a
 * canonical.
 */
function rewriteQuery(query: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  const page = Number.parseInt(query.get('page') ?? '', 10);
  if (Number.isFinite(page) && page > 0) {
    params.set('page', String(page + 1));
  }
  const search = query.get('search')?.trim();
  if (search) {
    params.set('search', search);
  }
  if (query.get('orderBy') === 'latest') {
    params.set('orderBy', 'latest');
  }
  return params;
}

function plural(kind: string): CommunityKind {
  return kind === 'project' ? 'projects' : 'components';
}
