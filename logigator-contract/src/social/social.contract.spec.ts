import { describe, expect, it } from 'vitest';
import { SOCIAL_PLATFORMS } from '@logigator/core';
import { socialPlatformSchema, socialUrlSchema } from './social.contract';

describe('socialUrlSchema', () => {
  it('answers the normalized URL rather than the one submitted', () => {
    const parsed = socialUrlSchema.parse(
      'https://Example.COM/Ada?utm_source=mail&tab=repos'
    );

    // What the form redraws and what the API stores: the request body is this
    // schema's `safeParse` output, so the stripping is not a second step a
    // caller could skip.
    expect(parsed).toBe('https://example.com/Ada?tab=repos');
  });

  it('rejects anything that is not an http(s) URL', () => {
    // `z.string().url()` alone accepts every one of these.
    for (const raw of [
      'javascript:alert(1)',
      'data:text/html,<script>x</script>',
      'mailto:ada@example.com',
      // Credentials: parses, with the host being the part after the `@`.
      'https://github.com@evil.example/x',
      'https://ada:pw@github.com/ada',
      // Protocol-relative: the scheme would come from wherever it is pasted.
      '//github.com/ada',
      'github.com/ada',
      ''
    ]) {
      expect(socialUrlSchema.safeParse(raw).success).toBe(false);
    }
  });

  it('refuses an oversized link before it looks at the URL', () => {
    const result = socialUrlSchema.safeParse(
      `https://example.com/${'a'.repeat(2100)}`
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe('too_big');
  });

  it('bounds the form it stores, not only the one that was typed', () => {
    // Percent-encoding grows a URL nine characters to one, so a paste well
    // under the cap has a canonical form well over it — and the column it is
    // written to holds 2048.
    const paste = `https://example.com/${'あ'.repeat(700)}`;
    expect(paste.length).toBeLessThan(2048);

    const result = socialUrlSchema.safeParse(paste);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe('too_big');
  });
});

describe('socialPlatformSchema', () => {
  it('is the platform table, not a copy of it', () => {
    expect(socialPlatformSchema.options).toEqual(
      SOCIAL_PLATFORMS.map((platform) => platform.id)
    );
  });
});
