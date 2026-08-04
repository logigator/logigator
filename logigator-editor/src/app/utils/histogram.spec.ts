import { describe, expect, it } from 'vitest';
import { formatHistogram, formatIndexHistogram } from './histogram';

describe('formatHistogram', () => {
  /** Blocks in a rendered row — the bar length the row actually shows. */
  function barLength(line: string): number {
    return (line.match(/█/g) ?? []).length;
  }

  it('scales the bars to the largest bucket', () => {
    const lines = formatHistogram(
      'counts',
      [
        { label: 'a', count: 10 },
        { label: 'b', count: 5 },
        { label: 'c', count: 1 }
      ],
      { width: 20 }
    );

    expect(barLength(lines[1])).toBe(20);
    expect(barLength(lines[2])).toBe(10);
  });

  it('keeps a bucket that rounds to nothing visible', () => {
    const lines = formatHistogram(
      'counts',
      [
        { label: 'a', count: 10_000 },
        { label: 'b', count: 1 }
      ],
      { width: 20 }
    );

    expect(barLength(lines[2])).toBe(1);
  });

  it('draws no bar for an empty bucket', () => {
    const lines = formatHistogram('counts', [
      { label: 'a', count: 3 },
      { label: 'b', count: 0 }
    ]);

    expect(barLength(lines[2])).toBe(0);
  });

  it('aligns the counts of every row in one column', () => {
    const lines = formatHistogram(
      'counts',
      [
        { label: 'short', count: 3 },
        { label: 'much longer', count: 4 }
      ],
      { width: 8 }
    );

    // Counts hold no spaces, so the last space of a row sits right before it.
    const countColumn = lines.slice(1).map((line) => line.lastIndexOf(' '));
    expect(new Set(countColumn).size).toBe(1);
  });

  it('notes an all-zero histogram instead of rendering empty bars', () => {
    const lines = formatHistogram('counts', [
      { label: 'a', count: 0 },
      { label: 'b', count: 0 }
    ]);

    expect(lines).toEqual(['counts:', '  (empty)']);
  });
});

describe('formatIndexHistogram', () => {
  it('renders a row per index, holes included, labelled by index', () => {
    const counts: number[] = [];
    counts[0] = 2;
    counts[3] = 4;

    const lines = formatIndexHistogram('by depth', counts);

    expect(lines).toHaveLength(5);
    expect(lines[1].trimStart().startsWith('0 ')).toBe(true);
    // Index 1 and 2 are holes: rows of their own, counting zero.
    expect(lines[2].trimEnd().endsWith(' 0')).toBe(true);
    expect(lines[3].trimEnd().endsWith(' 0')).toBe(true);
    expect(lines[4].trimStart().startsWith('3 ')).toBe(true);
  });
});
