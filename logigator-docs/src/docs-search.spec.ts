import { describe, expect, it } from 'vitest';
import {
  buildDocsIndex,
  DocsSearchEntry,
  DocsTextPart,
  highlight,
  markdownToText,
  matchRanges,
  searchDocs
} from './docs-search';
import { DocPageId } from './docs-structure';

/** The renderer's rule, as both viewers pass it in. */
function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function entry(page: DocPageId, markdown: string): DocsSearchEntry {
  return { page, markdown };
}

const SIMULATION = entry(
  'simulation',
  [
    '# Simulation',
    '',
    'Press play to run the circuit.',
    '',
    '## Speed Modes',
    '',
    'The engine free-runs, or paces itself to a target frequency.',
    '',
    '## Simulación en vivo',
    '',
    'El circuito se ejecuta mientras lo editas.'
  ].join('\n')
);

const CLOUD = entry(
  'cloud',
  ['# Cloud & Sharing', '', 'Sign in to keep a project in the cloud.'].join(
    '\n'
  )
);

const TABLE = [
  '| Action | Shortcut |',
  '| ------ | -------- |',
  '| Save   | `Ctrl+S` |'
].join('\n');

const SHORTCUTS = entry(
  'shortcuts',
  ['# Keyboard Shortcuts', '', '## File', '', TABLE].join('\n')
);

const index = buildDocsIndex([SIMULATION, CLOUD], slug);

/** A hit's parts, back as the string they were split from. */
function joined(parts: DocsTextPart[]): string {
  return parts.map((part) => part.text).join('');
}

describe('searchDocs', () => {
  /**
   * The anchor is the whole point of a hit: it is fed straight to the
   * renderer's `scrollToHeading`, which matches the slug of a heading's own
   * text. A page's own title gets none — that is the top of the page.
   */
  it('anchors a hit to the heading its section is under', () => {
    const [hit] = searchDocs(index, 'free-runs');

    expect(hit.page).toBe('simulation');
    expect(hit.anchor).toBe('speed-modes');
    expect(hit.heading).toBe('Speed Modes');
  });

  it('gives a page-title hit no anchor, the page being the destination', () => {
    const hit = searchDocs(index, 'simulation').find(
      (candidate) => candidate.heading === 'Simulation'
    );

    expect(hit?.anchor).toBeNull();
  });

  it('ranks the page named after the term above one that mentions it', () => {
    const hits = searchDocs(index, 'cloud');

    expect(hits[0].page).toBe('cloud');
    expect(hits[0].heading).toBe('Cloud & Sharing');
  });

  /**
   * Every section carries its page's title, so a query naming a page matches
   * all of them. The page's own opening has to come first: scoring the best
   * single field made them all score the same and the tie fell to whichever
   * heading sorted first alphabetically.
   */
  it('puts a page opening above its own sections for its own name', () => {
    const hits = searchDocs(index, 'simulation');

    expect(hits[0].heading).toBe('Simulation');
    expect(hits[0].anchor).toBeNull();
    expect(hits.map((hit) => hit.heading)).toContain('Simulación en vivo');
  });

  /** A word in a section's own heading beats one only its page is named for. */
  it('ranks a section named after the term above one that inherits it', () => {
    const hits = searchDocs(index, 'vivo');

    expect(hits[0].heading).toBe('Simulación en vivo');
  });

  /** Every term has to land somewhere, or the two-word query is noise. */
  it('drops a section missing one of the terms', () => {
    expect(searchDocs(index, 'speed modes')).not.toEqual([]);
    expect(searchDocs(index, 'speed hedgehog')).toEqual([]);
  });

  /**
   * Three of the four languages carry accents, and a reader does not reach for
   * the dead keys to search their own manual.
   */
  it('matches across the accents the query leaves off', () => {
    const [hit] = searchDocs(index, 'simulacion en vivo');

    expect(hit.heading).toBe('Simulación en vivo');
    expect(hit.anchor).toBe('simulación-en-vivo');
  });

  it('quotes the prose around the match, not the section opening', () => {
    const long = entry(
      'settings',
      [
        '# Settings',
        '',
        `${'Filler sentence about nothing in particular. '.repeat(6)}The keyboard shortcut manager lives here.`
      ].join('\n')
    );
    const [hit] = searchDocs(buildDocsIndex([long], slug), 'shortcut');

    expect(joined(hit.snippetParts)).toContain('shortcut manager');
  });

  it('leaves out what a page does not say', () => {
    expect(searchDocs(index, 'oscilloscope')).toEqual([]);
    expect(searchDocs(index, '   ')).toEqual([]);
  });

  /**
   * A table is where the answer is on the pages that carry one: the shortcut
   * reference is nothing else, so what a hit quotes has to be the row.
   */
  it('quotes a table row rather than its markup', () => {
    const [hit] = searchDocs(buildDocsIndex([SHORTCUTS], slug), 'save');

    expect(joined(hit.snippetParts)).toContain('Save — Ctrl+S');
    expect(joined(hit.snippetParts)).not.toContain('|');
  });
});

describe('markdownToText', () => {
  it('reads a table as its cells, dropping the rule under the header', () => {
    expect(markdownToText(TABLE)).toBe('Action — Shortcut Save — Ctrl+S');
  });

  it('drops a rule row that carries alignment', () => {
    const aligned = TABLE.replace('| ------ | -------- |', '| :--- | ---: |');

    expect(markdownToText(aligned)).toBe('Action — Shortcut Save — Ctrl+S');
  });
});

describe('highlight', () => {
  it('splits a string into its matched and unmatched runs, losing nothing', () => {
    const parts = highlight('Speed Modes', ['mode']);

    expect(joined(parts)).toBe('Speed Modes');
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(
      ['Mode']
    );
  });

  /**
   * Folding is not length-preserving, so a position in the folded string is
   * not one in the source. Marking by the wrong index marks the wrong letters.
   */
  it('marks the source letters an accent-folded match found', () => {
    // Authored with a combining acute rather than the precomposed letter, so
    // the folded string is a character shorter than the source it came from.
    const decomposed = 'Simulacio\u0301n en vivo';
    const parts = highlight(decomposed, ['simulacion']);

    expect(joined(parts)).toBe(decomposed);
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(
      ['Simulacio\u0301n']
    );
  });

  it('marks every occurrence, not only the first', () => {
    const parts = highlight('wire to wire', ['wire']);

    expect(parts.filter((part) => part.match)).toHaveLength(2);
  });
});

describe('matchRanges', () => {
  it('gives one range per run, merging terms that touch', () => {
    expect(matchRanges('Speed Modes', ['speed', 'modes'])).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 }
    ]);
  });

  /**
   * A text node counts in UTF-16 units, so a character outside the basic plane
   * before the match shifts it by two, not one — a `Range` built on the wrong
   * count marks the wrong letters or throws.
   */
  it('counts in UTF-16 units, as a text node does', () => {
    const text = '🔌 wires';

    expect(matchRanges(text, ['wires'])).toEqual([{ start: 3, end: 8 }]);
    expect(text.slice(3, 8)).toBe('wires');
  });

  it('finds a match the query left the accents off', () => {
    const text = 'Simulación';

    expect(matchRanges(text, ['simulacion'])).toEqual([
      { start: 0, end: text.length }
    ]);
  });

  it('has nothing to mark for a term that is not there', () => {
    expect(matchRanges('Speed Modes', ['tunnel'])).toEqual([]);
    expect(matchRanges('Speed Modes', [])).toEqual([]);
  });
});
