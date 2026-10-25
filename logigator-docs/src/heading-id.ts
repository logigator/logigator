/**
 * `{#id}` closing a heading line: the section's anchor. A translated heading
 * carries its English counterpart's id, so a `#fragment` names the same section
 * in every language.
 */
const HEADING_ID = /\s*\{#([^\s{}]+)\}\s*$/;

/** A markdown heading line: its level and its text. */
const HEADING_LINE = /^(#{1,6})\s+(.*)$/;

/** A heading's text without its `{#id}`, and the id, null when it has none. */
export function splitHeadingId(text: string): {
  text: string;
  id: string | null;
} {
  const match = HEADING_ID.exec(text);
  return match
    ? { text: text.slice(0, match.index), id: match[1] }
    : { text, id: null };
}

/** One heading of a page, in source order. */
export interface DocHeading {
  level: number;
  text: string;
  id: string | null;
}

/** Every heading a page's markdown carries, skipping fenced code. */
export function docHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
    }
    const heading = fenced ? null : HEADING_LINE.exec(line);
    if (heading) {
      headings.push({
        level: heading[1].length,
        ...splitHeadingId(heading[2])
      });
    }
  }
  return headings;
}

/** The markdown with every heading's `{#id}` taken off, as a reader sees it. */
export function stripHeadingIds(markdown: string): string {
  let fenced = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
      }
      return !fenced && HEADING_LINE.test(line)
        ? splitHeadingId(line).text
        : line;
    })
    .join('\n');
}
