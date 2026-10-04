/**
 * The one definition of how text a member wrote is cleaned on the way in.
 *
 * Shared for the reason the rest of `origin/` and `social/` are: two sides
 * have to agree and only one of them can be trusted. The contract's
 * `documentDescriptionSchema` and `bioSchema` normalize through this, so the
 * API stores the clean form and both apps' forms — which validate against the
 * same schemas — refuse exactly what the API refuses.
 *
 * It is about characters, never about markup. What a description renders as is
 * the renderer's rule (`@logigator/ui`'s user-content markdown), and escaping
 * for a given output is that output's rule. What is left here is the set of
 * characters that carry no text and exist to make a reader see something other
 * than what is stored.
 */

/**
 * Characters removed outright.
 *
 * Two families, both invisible and both a way to write one thing and show
 * another:
 *
 * - **The bidi reordering controls** (`U+202A`–`U+202E`, `U+2066`–`U+2069`).
 *   An embedding, override or isolate reorders the glyphs a reader sees
 *   without touching the string a moderator reads — the Trojan Source shape,
 *   and the one class of character that can make stored text and drawn text
 *   disagree outright.
 * - **The invisible blanks** (`U+200B`, `U+FEFF`). A zero-width space splits a
 *   word that a search or a filter then fails to match; a byte-order mark is
 *   an encoding artifact rather than something anybody typed.
 * - **Control characters** (C0 and C1) except `\n` and `\t`. They render as
 *   nothing or as a replacement box, and `\r` is handled separately below.
 *   Tab survives because an indented code block is four spaces or a tab, and a
 *   description explaining a circuit legitimately carries one.
 *
 * Deliberately *not* here, though they are equally invisible:
 *
 * - **The joiners** (`U+200C` ZWNJ, `U+200D` ZWJ). They are letters' work, not
 *   decoration: ZWJ is what joins `U+1F469 U+200D U+1F4BB` into one glyph
 *   rather than two, and ZWNJ is how Persian and the Indic scripts write a
 *   boundary inside a word. Stripping them corrupts ordinary text in the
 *   languages this site is translated into.
 * - **The directional marks** (`U+200E` LRM, `U+200F` RLM). They set the
 *   direction of a neutral character in mixed text — which is how somebody
 *   writing Arabic makes a trailing bracket land on the right side — and,
 *   unlike an override, cannot reverse a run. Legitimate, and not the attack.
 * - The soft hyphen, the non-breaking space and the variation selectors, which
 *   change how text is laid out rather than what it says.
 */
const STRIPPED =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/**
 * Text as it is stored: composed, with one kind of line break and nothing
 * invisible left in it.
 *
 * NFC rather than NFKC: composition makes two spellings of the same accented
 * word one string, which is what a comparison and a length both want.
 * Compatibility folding would go further and rewrite what the member typed —
 * `ﬁ` into `fi`, a full-width form into ASCII — which is a different word on
 * the screen, not a cleaner one.
 *
 * Trimmed last, and that is the point: `.trim()` does not remove `U+200B`, so
 * a string opening with a zero-width space and a real space survives an
 * earlier trim and comes back with a leading blank. Callers that cap a length
 * must cap what this returns — normalizing can change it in both directions.
 */
export function normalizeAuthoredText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(STRIPPED, '')
    .trim();
}
