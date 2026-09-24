import { expect } from 'vitest';
import type { JsonLdNode } from '../app/seo/structured-data';

/** A node as a consumer reads it: every property, none of them typed away. */
export type JsonLdTestNode = JsonLdNode & Record<string, unknown>;

/**
 * The one graph in the head, parsed.
 *
 * Asserting there is exactly one is part of reading it: a client-side
 * navigation reuses the document, and a second graph beside the first would
 * describe two pages at once and leave a consumer to guess which.
 */
export function jsonLdGraph(): JsonLdTestNode[] {
  const scripts = document.head.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  expect(scripts).toHaveLength(1);
  return (
    JSON.parse(scripts[0].textContent ?? '') as { '@graph': JsonLdTestNode[] }
  )['@graph'];
}

/** The one node of a type, for a graph that carries at most one of it. */
export function jsonLdNode(type: string): JsonLdTestNode | undefined {
  return jsonLdGraph().find((entry) => entry['@type'] === type);
}

/**
 * The head tags `SeoService` writes, removed between tests. It rewrites them in
 * place rather than appending, so what one test left behind is what the next
 * one would read.
 */
export function clearSeoHead(): void {
  for (const tag of document.head.querySelectorAll(
    'link[rel="canonical"], link[rel="alternate"], meta[property^="og:"], meta[name^="twitter:"], meta[name="robots"], script[type="application/ld+json"]'
  )) {
    tag.remove();
  }
}
