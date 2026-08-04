/** A `docs:` cross link's target: the page and an optional heading anchor. */
export interface DocsLinkTarget {
  page: string;
  anchor?: string;
}

/**
 * Parses a `docs:<page-id>` href (optionally `docs:<page-id>#<heading-anchor>`)
 * — the scheme documentation pages use for cross links between pages. Returns
 * null for an href of any other shape; those carry no doc semantics and keep
 * the markdown renderer's built-in link handling.
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
