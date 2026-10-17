import { describe, expect, it } from 'vitest';
import { toSocialLinks } from './social-links';

describe('toSocialLinks', () => {
  it('classifies each stored URL by its host, in the member´s order', () => {
    // The order is the profile's, not the table's: a member who put GitHub
    // first sees GitHub first.
    expect(
      toSocialLinks([
        'https://github.com/ada',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://fosstodon.org/@ada'
      ])
    ).toEqual([
      { url: 'https://github.com/ada', platform: 'github' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', platform: 'youtube' },
      { url: 'https://fosstodon.org/@ada', platform: 'mastodon' }
    ]);
  });

  it('keeps a host the table does not know, as `other`', () => {
    // Stored links are shown whether or not they are recognised; the fallback
    // names them by their host rather than dropping them.
    expect(toSocialLinks(['https://ada.example/blog'])).toEqual([
      { url: 'https://ada.example/blog', platform: 'other' }
    ]);
  });

  it('reads the host, not the string a member typed', () => {
    // The second layer of the phishing defence. This shape is rejected on
    // write, and if one ever reached the column the classification still could
    // not call it GitHub: `github.com` here is a user name and the host is
    // `evil.example`, which is also the name the website shows.
    expect(toSocialLinks(['https://github.com@evil.example/x'])).toEqual([
      { url: 'https://github.com@evil.example/x', platform: 'other' }
    ]);
  });

  it('does not deduplicate: three identical slots stay three', () => {
    const url = 'https://github.com/ada';
    expect(toSocialLinks([url, url, url])).toEqual([
      { url, platform: 'github' },
      { url, platform: 'github' },
      { url, platform: 'github' }
    ]);
  });
});
