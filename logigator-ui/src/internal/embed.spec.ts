import { describe, expect, it } from 'vitest';
import { EMBED_FORMATS, embedSnippet } from './embed';

const URL =
  'https://logigator.com/de/community/projects/2b0b6f0e-0000-4000-8000-0000';
const CARD =
  'https://logigator.com/api/share/project/2b0b6f0e-0000-4000-8000-0000/card.png';

const input = (title: string) => ({ url: URL, image: CARD, title });

describe('embedSnippet', () => {
  it('carries both absolute URLs in every format', () => {
    // The whole point of a snippet: pasted on somebody else's site, so nothing
    // in it may be relative — and the picture is worthless without the link.
    for (const format of EMBED_FORMATS) {
      const snippet = embedSnippet(format, input('Full adder'));
      expect(snippet, format).toContain(URL);
      expect(snippet, format).toContain(CARD);
    }
  });

  it('cannot be broken out of by a name that reads as markup', () => {
    const snippet = embedSnippet(
      'html',
      input('Half <script>alert(1)</script> adder "quoted"')
    );

    expect(snippet).not.toContain('<script>');
    expect(snippet).not.toContain('"quoted"');
    expect(snippet).toContain('&lt;script&gt;');
    expect(snippet).toContain('&quot;quoted&quot;');
  });

  it('escapes an ampersand once, not twice', () => {
    // The order of the replacements is load-bearing: escaping `<` first would
    // turn this into `&amp;amp;` and put that text in the forum post.
    expect(embedSnippet('html', input('NAND & AND'))).toContain(
      'NAND &amp; AND'
    );
  });

  it('keeps a bracketed name inside the markdown alt text', () => {
    const snippet = embedSnippet('markdown', input('Adder [4-bit]'));

    expect(snippet).toContain('[Adder \\[4-bit\\]]');
  });

  it('leaves the bbcode image address bare, having no text to escape', () => {
    // BBCode's placeholders are the URLs alone, so the name never reaches it.
    expect(embedSnippet('bbcode', input('Adder [4-bit]'))).toBe(
      `[url=${URL}][img]${CARD}[/img][/url]`
    );
  });
});
