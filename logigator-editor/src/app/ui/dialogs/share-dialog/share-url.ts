import { DEFAULT_LANGUAGE, isAvailableLanguage } from '@logigator/core';
import { shareLandingPath } from '@logigator/ui';

/**
 * Where a shared link lands: the site's own page for it, under the sharer's
 * language — not the editor's own `/share/:link` route, which is where that
 * page sends a reader. A pasted link has to unfurl, and the editor is a static
 * SPA shell whose `index.html` carries one generic card for every URL.
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
export function shareLandingUrl(lang: string, link: string): string {
  return `${window.location.origin}${languageSegment(lang)}${shareLandingPath(link)}`;
}

/**
 * A published document's community page, for the embed a published document
 * gets: a snippet is a link from somebody else's site, and the page that can
 * rank is the one it should carry.
 */
export function communityDocumentUrl(
  lang: string,
  kind: 'project' | 'component',
  link: string
): string {
  const table = kind === 'project' ? 'projects' : 'components';
  return `${window.location.origin}${languageSegment(lang)}/community/${table}/${link}`;
}

/** `/de`, from whatever the cookie happened to hold. */
function languageSegment(lang: string): string {
  return `/${isAvailableLanguage(lang) ? lang : DEFAULT_LANGUAGE}`;
}
