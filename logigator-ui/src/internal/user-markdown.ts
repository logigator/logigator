import { Marked, type Tokens } from 'marked';
import { escapeHtml } from './embed';

/**
 * How markdown a member wrote is rendered: a closed tag set, and destinations
 * that cannot reach anything this origin did not put there.
 *
 * Angular's sanitizer already runs over whatever reaches the DOM, and it is
 * good — `<script>`, `<style>` and every `on*` handler are gone before a
 * browser sees them. What it still allows is the reason this file exists. Its
 * element allowlist carries `class`, and Tailwind's utilities are global, so
 * `class="fixed inset-0 z-50"` is a way to cover a page that also shows the
 * editor and the account menu. It carries `src` on an image, so a description
 * on a public page is a way to log the address of everyone who reads it. Those
 * are not bugs in the sanitizer; they are markup a *document* may legitimately
 * carry and an author's paragraph may not.
 *
 * So the rule here does not filter markup, it declines to produce any: raw
 * HTML comes out as the text it was written as. What is left is what markdown
 * syntax itself emits, whose only attributes are a link's `href`, an image's
 * `src`/`alt`, a `title`, and a code fence's language class. The sanitizer then
 * runs over that as a second layer rather than as the only one.
 *
 * A word about where this lives: it is deliberately not routed through
 * `MarkdownService`. That service installs a renderer with `marked.use()` on
 * marked's **module-global** instance, so the moment this rule went through it,
 * every authored page rendered afterwards — the manual, the imprint, the
 * privacy policy — would start escaping its HTML and marking its own links
 * `nofollow`. An isolated `Marked` cannot leak that way, and it parses
 * synchronously, so a server render carries the finished prose in its first
 * byte rather than filling it in after hydration.
 */

/** Schemes a link may use. Everything else is a label with no destination. */
const LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto']);

/**
 * The scheme a destination names, or `undefined` for a relative one. The same
 * shape the renderer's own click handling matches, so what is written and what
 * is clicked agree about what counts as a scheme.
 */
function schemeOf(url: string): string | undefined {
  return /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase();
}

/**
 * Whether a link may keep its destination.
 *
 * A relative destination is allowed — it stays on this origin — except the
 * protocol-relative `//host/path`, which reads like a path and is not one.
 */
export function isAllowedLinkDestination(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  const scheme = schemeOf(trimmed);
  if (scheme === undefined) return !trimmed.startsWith('//');
  return LINK_SCHEMES.has(scheme);
}

/**
 * Whether an image may be fetched. Same-origin only, and there is nothing on
 * this origin an author can name yet: uploading an image to a description is a
 * storage row and a sweep rule that do not exist, so in practice every image
 * currently falls back to its alt text. The predicate is written as the rule
 * rather than as `false` so that adding the upload path is adding an upload
 * path, not rewriting the safety argument.
 *
 * Third-party images are the quiet one of these two. A description on a public
 * page is fetched by every reader, so an `<img>` pointing anywhere else is an
 * address log of who read it, running under somebody else's domain.
 */
export function isAllowedImageDestination(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('//')) return false;
  return schemeOf(trimmed) === undefined;
}

/**
 * A destination as an attribute value. marked does not export the `cleanUrl`
 * it uses for this, so the encoding is done here: percent-encode what a URL
 * may not carry raw, then put back the `%` of an escape that was already
 * written, so a link that arrives encoded is not encoded twice.
 */
function encodeDestination(url: string): string {
  try {
    return encodeURI(url.trim()).replace(/%25/g, '%');
  } catch {
    // A lone surrogate throws; there is no destination to be had from it.
    return '';
  }
}

/**
 * The renderer for authored text.
 *
 * Only the three hooks that can emit something an author should not control
 * are overridden; everything else is marked's own, which is the point — the
 * less of the renderer this file restates, the less of it can drift.
 */
const userMarked = new Marked({
  gfm: true,
  // A single newline is a line break. Every one of these fields was a plain
  // textarea whose newlines were shown as newlines, so without this the
  // paragraphs people have already written would collapse into one on the day
  // markdown is switched on.
  breaks: true,
  renderer: {
    /**
     * Raw HTML, as the text it was typed as. This is the whole closed-tag-set
     * argument in one method — and it is also the friendlier answer, because
     * `<clock>` in a description about a clock circuit stays on the page
     * instead of silently disappearing the way a filter would take it.
     */
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },

    /**
     * A fenced or indented block, without the `language-…` class marked would
     * put on it. Neither app configures a highlighter, so the class styles
     * nothing — and dropping it makes the rule absolute and testable: no
     * class attribute reaches the DOM from authored text, ever.
     */
    code({ text, escaped }: Tokens.Code): string {
      return `<pre><code>${escaped ? text : escapeHtml(text)}\n</code></pre>\n`;
    },

    /**
     * A task list's box, as a character rather than an `<input>`.
     *
     * marked emits a disabled checkbox, which is outside the tag set markdown
     * syntax should be able to reach here — and Angular's sanitizer drops it,
     * which would leave the item reading as a bare, unexplained indent. A
     * symbol says the same thing and survives.
     */
    checkbox({ checked }: Tokens.Checkbox): string {
      return checked ? '\u2611 ' : '\u2610 ';
    },

    /**
     * A link, or its label alone when the destination is one we will not
     * emit. `rel` and `target` are written into the markup rather than
     * attached by a click handler, because the first reader of a public
     * document's page is a crawler, which never runs one: `ugc` and `nofollow`
     * say this link is a visitor's rather than the site's, and `noopener`
     * with `noreferrer` keep the opened page away from this one.
     *
     * The title is dropped rather than escaped. It is a tooltip nobody writes
     * on purpose here, and every attribute not emitted is one that cannot be
     * broken out of.
     */
    link({ href, tokens }: Tokens.Link): string {
      const label = this.parser.parseInline(tokens);
      if (!isAllowedLinkDestination(href)) {
        return label;
      }
      const destination = encodeDestination(href);
      if (destination === '') {
        return label;
      }
      return (
        `<a href="${escapeHtml(destination)}"` +
        ` rel="nofollow ugc noopener noreferrer" target="_blank">${label}</a>`
      );
    },

    /**
     * An image, or its alt text. An image token is inline and already sits
     * inside a paragraph, so the fallback is the text itself with no wrapper
     * around it — the sentence an author wrote about the picture survives
     * even when the picture cannot.
     */
    image({ href, text }: Tokens.Image): string {
      if (!isAllowedImageDestination(href)) {
        return escapeHtml(text);
      }
      const destination = encodeDestination(href);
      if (destination === '') {
        return escapeHtml(text);
      }
      return `<img src="${escapeHtml(destination)}" alt="${escapeHtml(text)}">`;
    }
  }
});

/**
 * Authored markdown as the HTML it renders to.
 *
 * Synchronous on purpose: it is what lets a server render put a member's bio
 * in the first byte, and what keeps the editor's live preview from lagging a
 * keystroke behind the textarea.
 */
export function renderUserMarkdown(source: string): string {
  return userMarked.parse(source, { async: false });
}
