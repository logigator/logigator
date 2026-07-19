/** Where a link inside a rendered documentation page points. */
export type DocLinkTarget =
  | { kind: 'page'; page: string; anchor?: string }
  | { kind: 'anchor'; anchor: string }
  | { kind: 'external'; url: string }
  | { kind: 'none' };

/**
 * Classifies an anchor href from a rendered documentation page.
 *
 * Cross links between pages are authored as `docs:<page-id>` (optionally
 * `docs:<page-id>#<heading-anchor>`). Angular's HTML sanitizer doesn't know the
 * scheme and prefixes such hrefs with `unsafe:` on render, so that prefix is
 * stripped before matching — the links never navigate anyway, the viewer
 * intercepts the click.
 */
export function classifyDocLink(
  href: string | null | undefined
): DocLinkTarget {
  if (!href) {
    return { kind: 'none' };
  }
  const raw = href.startsWith('unsafe:') ? href.slice('unsafe:'.length) : href;
  if (raw.startsWith('docs:')) {
    const [page, anchor] = raw.slice('docs:'.length).split('#', 2);
    if (!page) {
      return anchor ? { kind: 'anchor', anchor } : { kind: 'none' };
    }
    return anchor ? { kind: 'page', page, anchor } : { kind: 'page', page };
  }
  if (raw.startsWith('#')) {
    const anchor = raw.slice(1);
    return anchor ? { kind: 'anchor', anchor } : { kind: 'none' };
  }
  if (/^https?:\/\//i.test(raw)) {
    return { kind: 'external', url: raw };
  }
  return { kind: 'none' };
}

/**
 * The anchor slug of a heading, derived from its text (lowercased,
 * non-alphanumeric runs collapsed to `-`). marked no longer emits heading ids,
 * so anchors resolve against rendered heading text at scroll time.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
