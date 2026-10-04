import { describe, expect, it } from 'vitest';
import { docPageSummary } from './docs-search';

describe('docPageSummary', () => {
  it('takes the paragraph under the title', () => {
    expect(
      docPageSummary(
        '# Getting Started\n\nWelcome to Logigator.\n\n## What is it?\n'
      )
    ).toBe('Welcome to Logigator.');
  });

  it('skips a block that would describe nothing', () => {
    const markdown = [
      '# Shortcuts',
      '![A screenshot of the board.](./images/board.png)',
      '> On macOS, `Ctrl` is `⌘`.',
      '| Action | Shortcut |',
      'Logigator is faster with the keyboard.'
    ].join('\n\n');

    expect(docPageSummary(markdown)).toBe(
      'Logigator is faster with the keyboard.'
    );
  });

  it('reads the markdown as the text it renders as', () => {
    expect(
      docPageSummary(
        '# Wires\n\nA **wire** joins two [ports](docs:components).'
      )
    ).toBe('A wire joins two ports.');
  });

  it('cuts a long paragraph on a word boundary', () => {
    const lede = `${'circuit '.repeat(40)}end.`;
    const description = docPageSummary(`# Long\n\n${lede}`) as string;

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith('circuit…')).toBe(true);
  });

  it('has nothing to say about a page that has not loaded', () => {
    expect(docPageSummary(null)).toBeNull();
    expect(docPageSummary('# Only a title\n')).toBeNull();
  });
});
