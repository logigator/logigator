import { describe, expect, it } from 'vitest';
import {
  classifySocialUrl,
  SOCIAL_PLATFORMS,
  socialHost,
  socialLinkLabel,
  socialPlatformLabel,
  type SocialPlatform
} from './social-platforms';

describe('classifySocialUrl', () => {
  it('recognises a host from the table', () => {
    expect(classifySocialUrl('https://github.com/ada')).toBe('github');
    expect(classifySocialUrl('https://www.youtube.com/@ada')).toBe('youtube');
    expect(classifySocialUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(classifySocialUrl('https://fosstodon.org/@ada')).toBe('mastodon');
  });

  it('ignores a leading `www.`, and only that label and only in front', () => {
    expect(classifySocialUrl('https://www.github.com/ada')).toBe('github');
    // Suffix matching would call this GitHub, which is what a phishing link
    // relies on a reader believing.
    expect(classifySocialUrl('https://github.com.evil.example/ada')).toBe(
      'other'
    );
    expect(classifySocialUrl('https://www.example.com.github.io/')).toBe(
      'other'
    );
    expect(classifySocialUrl('https://notgithub.com/ada')).toBe('other');
  });

  it('falls back rather than throwing on anything it cannot parse', () => {
    for (const input of ['', 'nonsense', 'javascript:alert(1)', '/relative']) {
      expect(classifySocialUrl(input)).toBe('other');
    }
  });

  it('names every platform by a label, and every host by exactly one', () => {
    const ids = new Set<string>();
    const hosts = new Set<string>();
    for (const platform of SOCIAL_PLATFORMS) {
      expect(platform.label).not.toBe('');
      expect(ids.has(platform.id)).toBe(false);
      ids.add(platform.id);
      for (const host of platform.hosts) {
        expect(host).toBe(host.toLowerCase());
        // Two platforms claiming one host would make classification depend on
        // the table's order.
        expect(hosts.has(host)).toBe(false);
        hosts.add(host);
      }
    }

    // The one entry that is a fallback rather than a platform: no host of its
    // own, and nothing classifies into it by matching.
    expect(SOCIAL_PLATFORMS.at(-1)?.id).toBe('other');
    expect(SOCIAL_PLATFORMS.at(-1)?.hosts).toEqual([]);
  });
});

describe('socialHost', () => {
  it('drops the `www.` and a trailing dot, and nothing else', () => {
    // Both are parts of a host that name nothing, and both are what the site
    // shows as a link's text — so `www.` must not survive into a name a reader
    // is meant to recognise.
    expect(socialHost('https://www.Example.com./x')).toBe('example.com');
    expect(socialHost('https://sub.example.com/')).toBe('sub.example.com');
    expect(socialHost('not a url')).toBe('');
  });
});

describe('socialLinkLabel', () => {
  it('names a recognised link by its platform', () => {
    expect(socialLinkLabel('github', 'https://github.com/ada')).toBe('GitHub');
    expect(socialPlatformLabel('stackoverflow')).toBe('Stack Overflow');
  });

  it('names an unrecognised link by its bare host, never by what was typed', () => {
    // The second layer of the phishing defence: the URL parses, so it could
    // have been stored by a path that skipped the normalizer, and the name
    // still comes from the host.
    expect(
      socialLinkLabel(
        classifySocialUrl('https://github.com@evil.example/x'),
        'https://github.com@evil.example/x'
      )
    ).toBe('evil.example');
    expect(
      socialLinkLabel('other', 'https://www.gitlab.com.evil.example/')
    ).toBe('gitlab.com.evil.example');
    // Nothing to derive a name from at all, which stored links never are.
    expect(socialLinkLabel('other', 'not a url')).toBe('');
  });

  it('recognises what the write path stores', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const id: SocialPlatform = platform.id;
      if (id === 'other') continue;
      const url = `https://${platform.hosts[0]}/ada`;
      expect(classifySocialUrl(url)).toBe(id);
      expect(socialLinkLabel(id, url)).toBe(platform.label);
    }
  });
});
