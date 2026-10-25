const XML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

/**
 * Text as XML character data, in one pass over it.
 *
 * One definition, because both XML responses this origin writes — the sitemap
 * and the changelog feed — carry stored text that a reader would otherwise be
 * able to end an element with, and a rule fixed in one of them and not the
 * other leaves the second one exploitable.
 */
export function escapeXml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (character) => XML_ENTITIES[character]);
}
