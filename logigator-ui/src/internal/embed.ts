/**
 * The snippet that puts a circuit on somebody else's page: the composed card,
 * linked to the page that can rank for it.
 *
 * Beside `share.ts` for its reason: the editor and the site must produce the
 * same bytes, because whoever pastes one into a forum post cannot tell which
 * app built it, and two copies of an escaping rule are two chances to get it
 * wrong in a place nobody looks.
 */

export type LgEmbedFormat = 'markdown' | 'html' | 'bbcode';

/** Presentation order, and the first is the default. */
export const EMBED_FORMATS: readonly LgEmbedFormat[] = [
  'markdown',
  'html',
  'bbcode'
];

export interface LgEmbedInput {
  /** Absolute URL the embed links to. */
  readonly url: string;
  /** Absolute URL of the composed card. */
  readonly image: string;
  /** The document's name: the alt text and the title attribute. */
  readonly title: string;
}

/**
 * One snippet per format — three projections of one input rather than three
 * shapes to fill in, which is why the format is a parameter and not a builder
 * each.
 *
 * `title` is stored user text, so it is escaped for the position it lands in:
 * a name carrying a quote would close an HTML attribute, and one carrying a
 * `<` could put markup into whichever page the snippet is pasted on. The URLs
 * are ours and are used verbatim — they are absolute by contract, a snippet
 * having no document of its own to resolve a path against.
 */
export function embedSnippet(
  format: LgEmbedFormat,
  input: LgEmbedInput
): string {
  const { url, image, title } = input;

  switch (format) {
    case 'html':
      // Sized at the card's own dimensions so a forum's layout does not jump
      // as it loads, and capped inline because a forum that does not cap `img`
      // would otherwise get a 1200px column.
      return `<a href="${url}" title="${escapeHtml(title)}"><img src="${image}" alt="${escapeHtml(title)}" width="1200" height="630" style="max-width:100%;height:auto"></a>`;
    case 'bbcode':
      // No text to escape: the card draws the name itself, and BBCode has no
      // place to put an alt.
      return `[url=${url}][img]${image}[/img][/url]`;
    case 'markdown':
      return `[![${escapeMarkdown(title)}](${image})](${url})`;
  }
}

/** `&` first, or the escapes the later replacements add would be escaped twice. */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Alt text sits inside `[…]`, where a bracket ends it early. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\[\]])/g, '\\$1');
}
