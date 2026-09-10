import { DocPageId } from './docs-structure';

/** One page's markdown, as the app that owns the import map loaded it. */
export interface DocsSearchEntry {
  page: DocPageId;
  markdown: string;
}

/** A run of a matched string, split so a view can mark the hits in it. */
export interface DocsTextPart {
  text: string;
  match: boolean;
}

/**
 * Where a match sits in a string, as **UTF-16 offsets** — what a DOM `Range`
 * counts in, this being for marking text a renderer has already written.
 */
export interface DocsTextRange {
  start: number;
  end: number;
}

/** One result: the section of a page a query matched, and where it is. */
export interface DocsSearchHit {
  page: DocPageId;
  /** Heading slug to jump to, or null for the page itself. */
  anchor: string | null;
  /** The section's heading, plain — an accessible name, and the fallback. */
  heading: string;
  headingParts: DocsTextPart[];
  snippetParts: DocsTextPart[];
  score: number;
}

/** A page's prose, cut at its headings; each cut is a possible hit. */
interface IndexedSection {
  page: DocPageId;
  anchor: string | null;
  heading: string;
  /** The page's own title, so a hit can be scored by the page it is in. */
  title: string;
  text: string;
  /** Folded once, so a query never folds them: matching happens in here. */
  folded: { heading: string; title: string; text: Folded };
}

export interface DocsIndex {
  sections: readonly IndexedSection[];
}

/**
 * How much a term matching in each field is worth.
 *
 * The section's own heading counts for most: a reader searching a word wants
 * the paragraph named after it. Every section carries its page's title too, so
 * that a query can span the two — "cloud upload" finds the upload section of
 * the cloud page — but weakly, or a page whose name matched would rank all of
 * its sections above the ones that actually discuss the word.
 */
const WEIGHT = { heading: 4, title: 2, text: 1 };
/** A term that starts a word beats one buried inside one. */
const WORD_START_BONUS = 1;
/**
 * A page's opening stands for the whole page, so when it matches at all it
 * leads the sections under it. Added once, not per term, so it breaks a tie
 * between siblings without ever outweighing a term one of them also matched.
 */
const PAGE_OPENING_BONUS = 1;
const SNIPPET_LENGTH = 160;
const DEFAULT_LIMIT = 12;

/** A folded string beside the source position each of its units came from. */
interface Folded {
  text: string;
  /**
   * `at[i]` is the index in the source array that `text`'s *i*-th UTF-16 unit
   * was folded from — units, not characters, because `indexOf` counts in them.
   */
  at: number[];
}

/**
 * A string as it is matched against: lower case, and with the accents taken
 * off. Three of the four languages carry them, so `simulacion` has to find
 * *Simulación* and `verbindung` *Verbindungen* — a reader typing a query does
 * not reach for the dead keys.
 *
 * Folded one character at a time, keeping where each result came from: folding
 * is not length-preserving (`ﬁ`, `İ`), so a position in the folded string is
 * not one in the source, and a highlight taken from the wrong index marks the
 * wrong letters.
 */
function fold(source: readonly string[]): Folded {
  let text = '';
  const at: number[] = [];
  for (let index = 0; index < source.length; index++) {
    const folded = source[index]
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    // Split rather than iterated: `for…of` over a string walks code points,
    // and what `at` has to line up with is what `indexOf` counts.
    for (const unit of folded.split('')) {
      text += unit;
      at.push(index);
    }
  }
  return { text, at };
}

/** A string as it is matched against; see {@link fold}. */
export function foldForSearch(text: string): string {
  return fold(characters(text)).text;
}

/**
 * A string as its characters rather than its UTF-16 units, so a cut never
 * lands inside a surrogate pair.
 */
function characters(text: string): string[] {
  return Array.from(text);
}

/** A query as the terms it is made of; every one of them has to match. */
export function searchTerms(query: string): string[] {
  return foldForSearch(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

/**
 * Markdown as the text it renders to, near enough to search and to quote:
 * pictures drop out, a link keeps its label, and the marks around emphasis,
 * code and headings go.
 *
 * A table's rule row goes and its cells are joined by a dash: five of the
 * eleven pages carry tables and the shortcut reference is one, so a quote left
 * as pipes and dashes would be half the snippets a reader ever sees.
 *
 * It is deliberately not a parser. What it feeds is a substring match and a
 * snippet, so a construct it renders imperfectly costs a slightly odd excerpt,
 * never a wrong destination — the anchors come from the heading text, which is
 * the one thing it strips exactly.
 */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(\*|_)([^*_]+)\1/g, '$2')
    .replace(/^[ \t]*\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, '')
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row: string) =>
      row
        .split('|')
        .map((cell) => cell.trim())
        .join(' — ')
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The searchable index of one language's documentation.
 *
 * `slug` is the renderer's own heading-slug rule, passed in rather than
 * reimplemented: a result jumps to `#<slug>`, and a second definition of that
 * rule would send half the hits to the top of the page instead. The member
 * stays dependency-free, and both viewers hand it `headingSlug`.
 */
export function buildDocsIndex(
  entries: readonly DocsSearchEntry[],
  slug: (heading: string) => string
): DocsIndex {
  const sections: IndexedSection[] = [];

  for (const entry of entries) {
    let title = '';
    // The lead is what stands before the first heading; every page opens with
    // its own `# …`, so in practice the first cut is that title's section.
    let current: { heading: string; anchor: string | null; lines: string[] } = {
      heading: '',
      anchor: null,
      lines: []
    };
    const flush = () => {
      const text = markdownToText(current.lines.join('\n'));
      if (!text && !current.heading) {
        return;
      }
      sections.push({
        page: entry.page,
        anchor: current.anchor,
        heading: current.heading,
        title,
        text,
        folded: {
          heading: foldForSearch(current.heading),
          title: foldForSearch(title),
          text: fold(characters(text))
        }
      });
    };

    for (const line of entry.markdown.split('\n')) {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!heading) {
        current.lines.push(line);
        continue;
      }
      flush();
      const text = markdownToText(heading[2]);
      const top = heading[1].length === 1 && title === '';
      if (top) {
        title = text;
      }
      // The page's own title is the page, so its hit carries no anchor.
      current = { heading: text, anchor: top ? null : slug(text), lines: [] };
    }
    flush();

    // A page whose title came after a section was flushed would have left that
    // section without one; the title is known only once the `# …` is read.
    for (const section of sections) {
      if (section.page === entry.page && !section.title) {
        section.title = title;
        section.folded.title = foldForSearch(title);
      }
    }
  }

  return { sections };
}

/**
 * The sections matching every term of `query`, best first.
 *
 * Ranking is by where the terms were found — the page's title, the section's
 * heading, the prose — because a reader searching "simulation" wants the page
 * about it before the eight pages that mention it.
 */
export function searchDocs(
  index: DocsIndex,
  query: string,
  limit: number = DEFAULT_LIMIT
): DocsSearchHit[] {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  const hits: DocsSearchHit[] = [];
  for (const section of index.sections) {
    const score = scoreSection(section, terms);
    if (score === null) {
      continue;
    }
    hits.push({
      page: section.page,
      anchor: section.anchor,
      heading: section.heading || section.title,
      headingParts: highlight(section.heading || section.title, terms),
      snippetParts: highlight(snippet(section, terms), terms),
      score
    });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.heading.localeCompare(b.heading))
    .slice(0, limit);
}

/**
 * A section's score, or null when a term is missing from all of its fields.
 *
 * The fields add up rather than the best one winning: a term in both the page
 * title and the section's own heading is a stronger hit than the same term in
 * the title alone, and taking the maximum made every section of a page whose
 * name matched score exactly the same — a tie broken alphabetically, which put
 * the page's own opening below whatever section happened to sort first.
 */
function scoreSection(section: IndexedSection, terms: string[]): number | null {
  let total = 0;
  for (const term of terms) {
    const found =
      fieldScore(section.folded.heading, term, WEIGHT.heading) +
      fieldScore(section.folded.title, term, WEIGHT.title) +
      fieldScore(section.folded.text.text, term, WEIGHT.text);
    if (found === 0) {
      return null;
    }
    total += found;
  }
  return section.anchor === null ? total + PAGE_OPENING_BONUS : total;
}

function fieldScore(field: string, term: string, weight: number): number {
  const at = field.indexOf(term);
  if (at === -1) {
    return 0;
  }
  const startsWord = at === 0 || !/[\p{L}\p{N}]/u.test(field[at - 1]);
  return weight + (startsWord ? WORD_START_BONUS : 0);
}

/**
 * The stretch of prose around the first term found in it, so a result shows
 * the sentence it matched rather than the section's opening words. Cut on word
 * boundaries; a section whose match is in its heading alone quotes its start.
 */
function snippet(section: IndexedSection, terms: string[]): string {
  const source = characters(section.text);
  if (source.length <= SNIPPET_LENGTH) {
    return section.text;
  }
  const found = terms
    .map((term) => section.folded.text.text.indexOf(term))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0];
  const at = found === undefined ? undefined : section.folded.text.at[found];

  if (at === undefined || at < SNIPPET_LENGTH / 2) {
    return `${cutAtWord(source.slice(0, SNIPPET_LENGTH), 'end')}…`;
  }
  const from = Math.round(at - SNIPPET_LENGTH / 3);
  const text = cutAtWord(source.slice(from, from + SNIPPET_LENGTH), 'start');
  const tail = from + SNIPPET_LENGTH >= source.length ? '' : '…';
  return `…${text}${tail}`;
}

/** Drops the partial word a fixed-length cut leaves at one end. */
function cutAtWord(source: string[], end: 'start' | 'end'): string {
  const space = end === 'start' ? source.indexOf(' ') : source.lastIndexOf(' ');
  if (space === -1) {
    return source.join('');
  }
  return (
    end === 'start' ? source.slice(space + 1) : source.slice(0, space)
  ).join('');
}

/**
 * `text` split into the parts a term matched and the parts it did not, so a
 * view marks the hits without building HTML out of content.
 */
export function highlight(
  text: string,
  terms: readonly string[]
): DocsTextPart[] {
  const source = characters(text);
  const matched = matchedCharacters(source, terms);

  const parts: DocsTextPart[] = [];
  for (let index = 0; index < source.length; index++) {
    const last = parts[parts.length - 1];
    if (last && last.match === matched[index]) {
      last.text += source[index];
    } else {
      parts.push({ text: source[index], match: matched[index] });
    }
  }
  return parts;
}

/**
 * Where `terms` match inside `text`, for a caller marking a string it does not
 * own — the rendered document, where the text is already in the DOM and the
 * matches become `Range`s over it rather than markup around it.
 *
 * The offsets are UTF-16, which is what a text node counts in; matching itself
 * is per character, so an astral character before a match does not shift it.
 */
export function matchRanges(
  text: string,
  terms: readonly string[]
): DocsTextRange[] {
  const source = characters(text);
  const matched = matchedCharacters(source, terms);

  const ranges: DocsTextRange[] = [];
  let offset = 0;
  let start: number | null = null;
  for (let index = 0; index < source.length; index++) {
    if (matched[index] && start === null) {
      start = offset;
    } else if (!matched[index] && start !== null) {
      ranges.push({ start, end: offset });
      start = null;
    }
    offset += source[index].length;
  }
  if (start !== null) {
    ranges.push({ start, end: offset });
  }
  return ranges;
}

/** Which of `source`'s characters any term covers. */
function matchedCharacters(
  source: readonly string[],
  terms: readonly string[]
): boolean[] {
  const folded = fold(source);
  const matched = new Array<boolean>(source.length).fill(false);
  for (const term of terms) {
    for (let at = folded.text.indexOf(term); at !== -1;) {
      const end = at + term.length;
      matched.fill(true, folded.at[at], folded.at[end - 1] + 1);
      at = folded.text.indexOf(term, end);
    }
  }
  return matched;
}
