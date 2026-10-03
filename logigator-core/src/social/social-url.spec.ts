import { describe, expect, it } from 'vitest';
import { normalizeSocialUrl } from './social-url';

describe('normalizeSocialUrl', () => {
  it('accepts http and https, and nothing else', () => {
    expect(normalizeSocialUrl('https://github.com/ada')).toBe(
      'https://github.com/ada'
    );
    expect(normalizeSocialUrl('http://github.com/ada')).toBe(
      'http://github.com/ada'
    );

    // The case `z.string().url()` alone would let through, and the reason the
    // protocol check is an allowlist rather than a format rule.
    expect(normalizeSocialUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSocialUrl('data:text/html,<script>x</script>')).toBeNull();
    expect(normalizeSocialUrl('mailto:ada@example.com')).toBeNull();
    expect(normalizeSocialUrl('ftp://example.com/x')).toBeNull();
  });

  it('rejects anything that is not an absolute URL', () => {
    // A host without a scheme has nowhere to resolve against, which is the one
    // rejection a member runs into by hand.
    expect(normalizeSocialUrl('github.com/ada')).toBeNull();
    expect(normalizeSocialUrl('/ada')).toBeNull();
    // Protocol-relative: the scheme would come from the page it is pasted into.
    expect(normalizeSocialUrl('//github.com/ada')).toBeNull();
    expect(normalizeSocialUrl('')).toBeNull();
    expect(normalizeSocialUrl('not a url')).toBeNull();
  });

  it('rejects a URL carrying credentials', () => {
    // Parses with `evil.example` for a host and `github.com` for a user name,
    // so a consumer printing the input would draw a GitHub link.
    expect(normalizeSocialUrl('https://github.com@evil.example/x')).toBeNull();
    expect(normalizeSocialUrl('https://ada:pw@github.com/ada')).toBeNull();
    expect(normalizeSocialUrl('http://user@example.com/')).toBeNull();
  });

  it('strips attribution parameters but keeps the ones that select content', () => {
    expect(
      normalizeSocialUrl(
        'https://example.com/p?utm_source=x&tab=answers&utm_medium=y#frag'
      )
    ).toBe('https://example.com/p?tab=answers#frag');

    // `?v=` is what makes a YouTube link point at a video at all, and the
    // share sheet's `si` is pure attribution beside it.
    expect(normalizeSocialUrl('https://youtu.be/dQw4w9WgXcQ?si=abc&t=30')).toBe(
      'https://youtu.be/dQw4w9WgXcQ?t=30'
    );
    expect(normalizeSocialUrl('https://example.com/?fbclid=xyz')).toBe(
      'https://example.com/'
    );
    // Case-insensitive, campaigns being authored by hand.
    expect(normalizeSocialUrl('https://example.com/?UTM_SOURCE=mail')).toBe(
      'https://example.com/'
    );
  });

  it('leaves the parameters it keeps exactly as they were written', () => {
    // A URLSearchParams round trip re-encodes every pair it carries — `%20`
    // becomes `+` — so stripping one parameter would rewrite the others, which
    // is a different query to a server that reads them literally.
    expect(
      normalizeSocialUrl(
        'https://example.org/s?q=c%20templates&utm_source=mail'
      )
    ).toBe('https://example.org/s?q=c%20templates');
    expect(
      normalizeSocialUrl('https://example.org/s?q=~a&utm_source=mail')
    ).toBe('https://example.org/s?q=~a');
  });

  it('rejects a link whose host names nothing', () => {
    // Both parse and pass every other check, and both draw as a link with no
    // text and no accessible name.
    expect(normalizeSocialUrl('https://www./')).toBeNull();
    expect(normalizeSocialUrl('https://./')).toBeNull();
  });

  it('answers the parser canonical form', () => {
    // Host lower-cased, IDN punycoded, default port dropped — path case and
    // trailing slash are the address, so they stay.
    expect(normalizeSocialUrl('https://GitHub.COM/Ada')).toBe(
      'https://github.com/Ada'
    );
    expect(normalizeSocialUrl('https://BÜCHER.example/')).toBe(
      'https://xn--bcher-kva.example/'
    );
    expect(normalizeSocialUrl('https://example.com:443/x')).toBe(
      'https://example.com/x'
    );
    expect(normalizeSocialUrl('https://example.com:8443/x')).toBe(
      'https://example.com:8443/x'
    );
  });

  it('is idempotent, so a stored link re-normalizes to itself', () => {
    const once = normalizeSocialUrl('https://example.com/a?utm_source=x&b=1');
    expect(once).not.toBeNull();
    expect(normalizeSocialUrl(once as string)).toBe(once);
  });
});
