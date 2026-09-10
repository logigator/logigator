/** A `docs:` cross link's target: the page and an optional heading anchor. */
export interface DocsLinkTarget {
  page: string;
  anchor?: string;
}

/**
 * Parses a `docs:<page-id>` href, optionally `docs:<page-id>#<anchor>`. Null
 * for any other shape, which keeps the markdown renderer's own link handling.
 */
export function parseDocsLink(href: string): DocsLinkTarget | null {
  if (!href.startsWith('docs:')) {
    return null;
  }
  const [page, anchor] = href.slice('docs:'.length).split('#', 2);
  if (!page) {
    return null;
  }
  return anchor ? { page, anchor } : { page };
}
