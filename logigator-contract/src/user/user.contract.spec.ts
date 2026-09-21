import { describe, expect, it } from 'vitest';
import { updateUserRequestSchema, websiteUrlSchema } from './user.contract';

describe('updateUserRequestSchema', () => {
  it('carries the profile fields beside the credential ones', () => {
    const parsed = updateUserRequestSchema.parse({
      bio: '  I build logic gates.  ',
      websiteUrl: 'https://Example.com/?utm_source=mail',
      socialLinks: ['https://github.com/ada']
    });

    // The bio is trimmed like every other authored string; the URL is the
    // normalizer's output, tracking parameters included in what it removes.
    expect(parsed.bio).toBe('I build logic gates.');
    expect(parsed.websiteUrl).toBe('https://example.com/');
    expect(parsed.socialLinks).toEqual(['https://github.com/ada']);
  });

  it('round-trips an exact-duplicate set intact', () => {
    // Deliberately allowed: the same link in three slots is a member saying the
    // same thing three times, and nothing here deduplicates or reorders.
    const url = 'https://github.com/ada';
    const parsed = updateUserRequestSchema.parse({
      socialLinks: [url, url, url]
    });

    expect(parsed.socialLinks).toEqual([url, url, url]);
  });

  it('holds at most three links', () => {
    const url = 'https://github.com/ada';
    expect(
      updateUserRequestSchema.safeParse({ socialLinks: [url, url, url, url] })
        .success
    ).toBe(false);
    // An empty list is how the row is cleared, so it is a valid body.
    expect(
      updateUserRequestSchema.parse({ socialLinks: [] }).socialLinks
    ).toEqual([]);
  });

  it('rejects one bad link in the list rather than the list as a whole', () => {
    expect(
      updateUserRequestSchema.safeParse({
        socialLinks: ['https://github.com/ada', 'javascript:alert(1)']
      }).success
    ).toBe(false);
  });

  it('still refuses a body with nothing to update', () => {
    expect(updateUserRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('websiteUrlSchema', () => {
  it('takes null as the way to say "no website"', () => {
    expect(websiteUrlSchema.parse(null)).toBeNull();
  });

  it('does not accept an empty string in place of null', () => {
    // The column distinguishes "no website" from "an empty one", and a client
    // clearing the field sends the state it means rather than a blank.
    expect(websiteUrlSchema.safeParse('').success).toBe(false);
  });
});
