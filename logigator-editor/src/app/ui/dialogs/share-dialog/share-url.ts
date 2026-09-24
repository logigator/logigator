import { DEFAULT_LANGUAGE, isAvailableLanguage } from '@logigator/core';
import { documentPath, type LgDocumentKind } from '@logigator/ui';
import { routeKindOf } from '../../../routing/document-kind';

/**
 * Where a shared link lands: the site's own page for the document, under the
 * sharer's language — not the editor's own `/share/{kind}/{link}` route, which
 * is where that page sends a reader. A pasted link has to unfurl, and the
 * editor is a static SPA shell whose `index.html` carries one generic card for
 * every URL.
 *
 * One builder for every state, because there is one address in every state: a
 * document's page lives at `/community/{kind}/{link}` whether it is listed, and
 * the link is what makes it resolve. What changes with the state is whether
 * anybody else can open it, not where it is.
 *
 * The kind arrives in the API's spelling — that is what a dialog holds — and is
 * spelled the way the route does it here, the one mapping being
 * `routing/document-kind.ts`'s.
 *
 * The origin is `window.location`'s: the editor is served under `/editor` on
 * the origin whose root the site answers, so the two are the same host. There
 * is deliberately no configured site URL — a second source of truth for
 * something the browser already knows is one a deployment can get wrong, and
 * the failure would be links to a host nobody serves.
 *
 * The language is validated rather than trusted. It comes from the origin-wide
 * `preferences` cookie, which is client-writable and need not name a language
 * either app can render.
 */
export function shareDocumentUrl(
  lang: string,
  kind: LgDocumentKind,
  link: string
): string {
  return `${window.location.origin}${languageSegment(lang)}${documentPath(routeKindOf(kind), link)}`;
}

/** `/de`, from whatever the cookie happened to hold. */
function languageSegment(lang: string): string {
  return `/${isAvailableLanguage(lang) ? lang : DEFAULT_LANGUAGE}`;
}
