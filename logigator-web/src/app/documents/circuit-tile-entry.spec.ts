import { describe, expect, it } from 'vitest';
import { communityRow } from '../../testing/community-rows';
import { toTileEntries } from './circuit-tile-entry';

const ROW = communityRow('8-Bit ALU', 'abc');

describe('toTileEntries', () => {
  it('names the author and the tally where a list has both to say', () => {
    const [entry] = toTileEntries([ROW], {
      href: (row) => `/en/community/projects/${row.link}`,
      authorHref: (row) => `/en/community/users/${row.link}`
    });

    expect(entry.meta).toEqual({
      author: {
        username: 'marek_h',
        avatar: null,
        href: '/en/community/users/abc'
      },
      stars: 12
    });
  });

  it('keeps the tally and drops the author where every row shares one', () => {
    // A member's own page: the heading above the grid says whose list it is, so
    // naming them on every tile says nothing — but the star count is what each
    // circuit collected, which is the number the page exists to show.
    const [entry] = toTileEntries([ROW], {
      href: (row) => `/en/community/projects/${row.link}`
    });

    expect(entry.meta).toEqual({ author: null, stars: 12 });
  });

  it('draws no meta row at all where a list asks for none', () => {
    // The home page's curated examples: one account's work, and not a ranking.
    const [entry] = toTileEntries([ROW], {
      href: (row) => `/en/community/projects/${row.link}`,
      meta: false
    });

    expect(entry.meta).toBeNull();
  });
});
