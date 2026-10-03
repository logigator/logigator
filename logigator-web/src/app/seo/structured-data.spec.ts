import { describe, expect, it } from 'vitest';
import {
  absoluteAssetUrl,
  isoDuration,
  serializeJsonLd
} from './structured-data';

describe('serializeJsonLd', () => {
  it('cannot be closed early by a string it carries', () => {
    // The page's own strings are translations today and will be circuit names
    // and usernames once the community pages land, so a `<` reaching the
    // document as itself is stored text becoming markup.
    const json = serializeJsonLd([
      {
        '@type': 'WebSite',
        name: '</script><img src=x onerror=alert(1)>'
      } as never
    ]);

    expect(json).not.toContain('</script>');
    expect(json).not.toContain('<');
    const parsed = JSON.parse(json) as {
      '@graph': { name: string }[];
    };
    expect(parsed['@graph'][0].name).toBe(
      '</script><img src=x onerror=alert(1)>'
    );
  });
});

describe('absoluteAssetUrl', () => {
  it('resolves a hashed import against the origin', () => {
    // The imports are document-relative, which a crawler reading JSON-LD has
    // no document to resolve.
    expect(
      absoluteAssetUrl('https://logigator.com', './media/hero-ABC123.webp')
    ).toBe('https://logigator.com/media/hero-ABC123.webp');
  });

  it('leaves a URL that already names its host', () => {
    expect(
      absoluteAssetUrl('https://logigator.com', 'https://cdn.test/a.webp')
    ).toBe('https://cdn.test/a.webp');
  });
});

describe('isoDuration', () => {
  it('converts the clock form the videos are authored in', () => {
    expect(isoDuration('3:34')).toBe('PT3M34S');
    expect(isoDuration('1:02:03')).toBe('PT1H2M3S');
  });

  it('drops a zero part rather than emitting it', () => {
    expect(isoDuration('4:00')).toBe('PT4M');
  });

  it('answers empty for anything it cannot read', () => {
    // The caller leaves the property out on empty; a wrong duration would be
    // published as fact.
    expect(isoDuration('later')).toBe('');
    expect(isoDuration('90')).toBe('');
  });
});
