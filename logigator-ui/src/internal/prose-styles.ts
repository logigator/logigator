/**
 * How rendered markdown looks — **once**, for the page and for the editor.
 *
 * `lg-markdown` draws what a reader sees and the markdown field's rich surface
 * draws what its author is writing, and the whole promise of editing in place
 * is that those two are the same picture. Two stylesheets would drift the
 * first time either was touched, so there is one, scoped under a class both
 * put on the element the prose is inside.
 *
 * It is a string rather than a `.css` file because every component in this
 * library carries its styles inline: the library is never built, so a
 * `styleUrls` path would have to be resolved by each consuming application's
 * bundler instead of by one build of its own.
 *
 * **Both consumers must render it with `ViewEncapsulation.None`.** Neither
 * owns the elements these rules select — one assigns `innerHTML`, the other
 * hands its element to ProseMirror — so an emulated scope's attribute never
 * reaches them and every rule silently matches nothing. The `.lg-prose` class
 * is what keeps that safe: nothing here selects an element that does not have
 * it above it.
 */
export const LG_PROSE_STYLES = `
  .lg-prose {
    color: var(--lg-text);
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  .lg-prose h1,
  .lg-prose h2,
  .lg-prose h3,
  .lg-prose h4 {
    font-weight: 700;
    line-height: 1.25;
    color: var(--lg-text);
  }

  .lg-prose h1 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
  }

  .lg-prose h2 {
    font-size: 1.25rem;
    margin: 1.75rem 0 0.75rem;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid var(--lg-border);
  }

  .lg-prose h3 {
    font-size: 1.0625rem;
    margin: 1.5rem 0 0.5rem;
  }

  .lg-prose h4 {
    font-size: 0.9375rem;
    margin: 1.25rem 0 0.5rem;
    /* Muted, not the content token this said before the two renderings were
       compared against each other: that one is the *surface* a card sits on,
       #ffffff in light mode, so a fourth-level heading was white on white.
       Nothing authored uses one yet, which is why nobody had seen it. */
    color: var(--lg-muted);
  }

  .lg-prose > :first-child {
    margin-top: 0;
  }

  .lg-prose > :last-child {
    margin-bottom: 0;
  }

  .lg-prose p {
    margin: 0 0 0.75rem;
  }

  .lg-prose ul,
  .lg-prose ol {
    margin: 0 0 0.75rem;
    padding-left: 1.5rem;
  }

  .lg-prose ul {
    list-style: disc outside;
  }

  .lg-prose ol {
    list-style: decimal outside;
  }

  .lg-prose li {
    margin: 0.25rem 0;
  }

  .lg-prose li::marker {
    color: var(--lg-muted);
  }

  /*
   * A list item and a table cell hold block content, and the last block in one
   * must not push the box open underneath itself.
   *
   * This is what keeps the two renderings the same height. A tight list is
   * \`<li>text</li>\` from the page's renderer and \`<li><p>text</p></li>\` from
   * the editor's, which is not a difference anyone can see — until the
   * paragraph inside brings its own bottom margin with it. The same goes for
   * every table cell, whose content is always a paragraph on one side and
   * never one on the other. A loose list, which is paragraphs on both sides,
   * keeps the space between them and loses only the trailing one.
   */
  .lg-prose li > :last-child,
  .lg-prose th > :last-child,
  .lg-prose td > :last-child {
    margin-bottom: 0;
  }

  .lg-prose a {
    color: var(--lg-primary);
    text-decoration: none;
  }

  .lg-prose a:hover {
    text-decoration: underline;
  }

  .lg-prose strong {
    font-weight: 700;
  }

  .lg-prose em {
    font-style: italic;
  }

  .lg-prose code {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    background: var(--lg-content-hover);
    border-radius: 0.25rem;
    padding: 0.1em 0.35em;
  }

  .lg-prose pre {
    background: var(--lg-content-hover);
    border: 1px solid var(--lg-border);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    margin: 0 0 0.75rem;
  }

  .lg-prose pre code {
    background: none;
    padding: 0;
    font-size: 0.85rem;
  }

  .lg-prose blockquote {
    margin: 0 0 0.75rem;
    padding: 0.25rem 0 0.25rem 1rem;
    border-left: 3px solid var(--lg-border);
    color: var(--lg-muted);
  }

  .lg-prose blockquote > :last-child {
    margin-bottom: 0;
  }

  .lg-prose hr {
    border: none;
    border-top: 1px solid var(--lg-border);
    margin: 1.5rem 0;
  }

  .lg-prose table {
    border-collapse: collapse;
    margin: 0 0 0.75rem;
    width: 100%;
  }

  .lg-prose th,
  .lg-prose td {
    border: 1px solid var(--lg-border);
    padding: 0.35rem 0.6rem;
    text-align: left;
  }

  .lg-prose th {
    background: var(--lg-content-hover);
    font-weight: 700;
  }

  .lg-prose img {
    display: block;
    max-width: 100%;
    max-height: 24rem;
    margin: auto;
  }
`;

/**
 * What changes when the prose is **a member's**, rather than the site's own.
 *
 * A description or a bio is a fragment quoted inside somebody else's page, and
 * it was being drawn with the contract written for a documentation page, which
 * owns the whole screen. The result was not that the two were hard to tell
 * apart — it was that the member outranked the site: a `#` in a description
 * rendered at 1.5rem bold against the 1rem semibold of the page's own section
 * heading above it, and a `##` drew a full-width rule indistinguishable from a
 * section divider.
 *
 * So the ceiling is the page's own section heading, and nothing an author
 * writes may reach it. Levels stay apart by weight and spacing instead of by
 * size, sized from `data-level` because the page's renderer has moved the tags
 * two levels down and the editor's has not — both emit the level that was
 * *written*, which is the thing that has to look the same in both.
 *
 * The body is muted for the same reason the site's own captions are not:
 * structure is the page's voice, quoted prose is somebody else's. A heading
 * inside it is still stronger than the text around it, which is all a heading
 * in a fragment this short ever needed to be.
 *
 * Applies wherever `data-user-content` is set — `lg-markdown`'s own flag, and
 * the markdown field's editing surface, which is member text by definition.
 */
export const LG_USER_PROSE_STYLES = `
  .lg-prose[data-user-content] {
    color: var(--lg-muted);
  }

  .lg-prose[data-user-content] h1,
  .lg-prose[data-user-content] h2,
  .lg-prose[data-user-content] h3,
  .lg-prose[data-user-content] h4,
  .lg-prose[data-user-content] h5,
  .lg-prose[data-user-content] h6 {
    font-size: 1em;
    font-weight: 600;
    line-height: 1.4;
    color: var(--lg-text);
    margin: 1.25rem 0 0.35rem;
    /* The section-divider look, which is the page's to draw and not an
       author's. */
    padding-bottom: 0;
    border-bottom: none;
  }

  .lg-prose[data-user-content] [data-level='1'] {
    font-size: 1.05em;
    font-weight: 700;
    color: var(--lg-text-hover);
  }

  .lg-prose[data-user-content] [data-level='2'] {
    font-weight: 700;
  }

  /*
   * No space above the first block or below the last — restated here, and
   * with two selectors, for two reasons that both come down to this file
   * having to beat itself.
   *
   * The heading rules above are one class, one attribute and a type, which
   * outranks the shared sheet's plain first-child reset; a heading written as
   * the opening line therefore kept its top margin and pushed itself down the
   * box. And the two renderers put the content at different depths — the page
   * into a wrapper of its own, the editor into the surface itself — so a
   * single selector cannot reach both.
   */
  .lg-prose[data-user-content] > :first-child,
  .lg-prose[data-user-content] > [data-user-content] > :first-child {
    margin-top: 0;
  }

  .lg-prose[data-user-content] > :last-child,
  .lg-prose[data-user-content] > [data-user-content] > :last-child {
    margin-bottom: 0;
  }
`;
