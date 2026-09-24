import { describe, expect, it } from 'vitest';
import {
  isAllowedImageDestination,
  isAllowedLinkDestination,
  renderUserMarkdown
} from './user-markdown';

/**
 * The invariants, asserted against the parsed DOM rather than the string.
 *
 * That distinction is the whole point of the rule: `&lt;div class=…` in the
 * output is the *safe* outcome — text that says what an author typed — while
 * the same characters as real markup are the unsafe one. Only a parse can tell
 * those apart, and a browser parse is what the output actually faces.
 */
function parse(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

const FORBIDDEN_ELEMENTS =
  'script, iframe, style, object, embed, link, meta, base, form, input, svg, math';

function expectInert(html: string): void {
  const host = parse(html);
  expect(host.querySelector(FORBIDDEN_ELEMENTS)).toBeNull();

  for (const element of host.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      // No handler, and none of the two attributes Angular's own sanitizer
      // would have let through: `class` reaches Tailwind's global utilities,
      // `style` is a layout of the author's choosing.
      expect(name).not.toMatch(/^on/);
      expect(name).not.toBe('class');
      expect(name).not.toBe('style');
      if (name === 'href' || name === 'src') {
        expect(value).not.toMatch(/^javascript:/);
        expect(value).not.toMatch(/^data:/);
        expect(value).not.toMatch(/^vbscript:/);
      }
    }
  }
}

describe('renderUserMarkdown', () => {
  it('renders the formatting an author actually wants', () => {
    const html = renderUserMarkdown(
      '# Adder\n\nA **four-bit** adder with *carry*.\n\n- one\n- two\n\n`code()`'
    );
    expect(html).toContain('<h3 data-level="1">Adder</h3>');
    expect(html).toContain('<strong>four-bit</strong>');
    expect(html).toContain('<em>carry</em>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<code>code()</code>');
    expectInert(html);
  });

  it('leaves the top two heading levels to the page', () => {
    // A description and a bio are fragments quoted inside somebody else's
    // page. A bio opening with `# Hi` used to put a second `<h1>` on a
    // profile beside the member's own name, and a crawler reading the outline
    // found the member's words where the site's structure should be.
    const html = renderUserMarkdown('# one\n\n## two\n\n### three');
    expect(html).not.toMatch(/<h[12][\s>]/);
    expect(html).toContain('<h3 data-level="1">one</h3>');
    expect(html).toContain('<h4 data-level="2">two</h4>');
    expect(html).toContain('<h5 data-level="3">three</h5>');
  });

  it('runs out of levels rather than out of tags', () => {
    // Two levels down puts the deepest of them past `h6`, which is not a tag.
    const html = renderUserMarkdown('##### five\n\n###### six');
    expect(html).toContain('<h6 data-level="5">five</h6>');
    expect(html).toContain('<h6 data-level="6">six</h6>');
  });

  it('shows raw HTML as text rather than dropping it', () => {
    // A filter would delete this; an author writing about a `<clock>` block
    // would watch their sentence lose a word for no stated reason.
    const html = renderUserMarkdown('The <clock> input drives it.');
    expect(html).toContain('&lt;clock&gt;');
    expect(html).not.toContain('<clock>');
  });

  it('emits no script, however it is written', () => {
    for (const source of [
      '<script>alert(1)</script>',
      '<SCRIPT SRC=//evil.tld/x.js></SCRIPT>',
      '<img src=x onerror="alert(1)">',
      '<div onclick="alert(1)">x</div>',
      '<iframe src="https://evil.tld"></iframe>',
      '<style>body{display:none}</style>',
      '<svg><animate onbegin="alert(1)" /></svg>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'
    ]) {
      expectInert(renderUserMarkdown(source));
    }
  });

  it('refuses a class attribute, which on this origin is a layout weapon', () => {
    // Tailwind's utilities are global: this would cover the page it sits on.
    const html = renderUserMarkdown(
      '<div class="fixed inset-0 z-50 bg-white">nothing to see</div>'
    );
    expectInert(html);
    // Present, and present as text: the sentence survives, the layout does not.
    expect(parse(html).textContent).toContain('<div class="fixed inset-0 z-50');
  });

  it('keeps an entity-encoded tag encoded', () => {
    const html = renderUserMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;');
    expectInert(html);
  });

  it('drops a link destination it will not emit, keeping the label', () => {
    for (const source of [
      '[click](javascript:alert(1))',
      '[click](data:text/html,<script>alert(1)</script>)',
      '[click](vbscript:msgbox)',
      '[click](JaVaScRiPt:alert(1))',
      '[click](  javascript:alert(1))'
    ]) {
      const html = renderUserMarkdown(source);
      expect(html).toContain('click');
      expect(html).not.toContain('<a ');
      expectInert(html);
    }
  });

  it('marks a link it does emit as a visitor’s, in the markup', () => {
    // A crawler reads the first byte and runs no handler, so this has to be
    // written rather than attached.
    const html = renderUserMarkdown('[docs](https://example.com/a)');
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('keeps a relative link but refuses a protocol-relative one', () => {
    expect(renderUserMarkdown('[a](/community)')).toContain(
      'href="/community"'
    );
    // `//evil.tld/x` reads like a path and is a different origin.
    const html = renderUserMarkdown('[a](//evil.tld/x)');
    expect(html).not.toContain('<a ');
    expect(html).toContain('a');
  });

  it('drops a link title rather than escaping it', () => {
    const html = renderUserMarkdown('[a](https://example.com "t\\"x")');
    expect(html).not.toContain('title=');
  });

  it('renders an image as its alt text, there being no image to fetch', () => {
    for (const source of [
      '![diagram](https://evil.tld/pixel.png)',
      '![diagram](//evil.tld/pixel.png)',
      '![diagram](http://evil.tld/pixel.png)'
    ]) {
      const html = renderUserMarkdown(source);
      expect(html).not.toContain('<img');
      expect(html).toContain('diagram');
    }
  });

  it('escapes an alt text that is trying to be markup', () => {
    const html = renderUserMarkdown(
      '![<script>alert(1)</script>](//evil.tld/p)'
    );
    expectInert(html);
  });

  it('survives the malformed and the deeply nested', () => {
    // A cap upstream bounds the source; what matters here is that none of it
    // throws and takes a page render with it.
    expect(() => renderUserMarkdown('[a](b')).not.toThrow();
    expect(() => renderUserMarkdown('![a](')).not.toThrow();
    expect(() => renderUserMarkdown('>'.repeat(200) + ' deep')).not.toThrow();
    expect(() => renderUserMarkdown('*'.repeat(500))).not.toThrow();
    expect(() => renderUserMarkdown('['.repeat(500))).not.toThrow();
    expect(renderUserMarkdown('')).toBe('');
  });

  it('renders a fenced block without a language class', () => {
    // Nothing highlights in either app, so the class marked adds would style
    // nothing — and leaving it out is what makes "no class attribute, ever"
    // a rule that can be asserted rather than a rule with one exception.
    const html = renderUserMarkdown('```js\nlet a = "<x>"\n```');
    expectInert(html);
    expect(parse(html).querySelector('pre code')?.textContent).toContain(
      'let a = "<x>"'
    );
  });

  it('renders a task list as characters, not form controls', () => {
    // marked emits a disabled `<input type=checkbox>`, which the sanitizer
    // then drops — leaving an item that reads as an unexplained indent.
    const html = renderUserMarkdown('- [ ] todo\n- [x] done');
    expectInert(html);
    const items = parse(html).querySelectorAll('li');
    expect(items[0]?.textContent?.trim()).toBe('\u2610 todo');
    expect(items[1]?.textContent?.trim()).toBe('\u2611 done');
  });

  it('treats a single newline as a line break', () => {
    // Every one of these fields was a textarea whose newlines were shown as
    // newlines; without this the paragraphs already written would collapse.
    expect(renderUserMarkdown('one\ntwo')).toContain('<br>');
  });
});

describe('isAllowedLinkDestination', () => {
  it('allows the three schemes a member has a reason to write', () => {
    expect(isAllowedLinkDestination('https://example.com')).toBe(true);
    expect(isAllowedLinkDestination('http://example.com')).toBe(true);
    expect(isAllowedLinkDestination('mailto:a@example.com')).toBe(true);
    expect(isAllowedLinkDestination('/community/project/abc')).toBe(true);
    expect(isAllowedLinkDestination('#section')).toBe(true);
  });

  it('refuses everything else, including the empty destination', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.tld/x',
      '',
      '   '
    ]) {
      expect(isAllowedLinkDestination(url)).toBe(false);
    }
  });
});

describe('isAllowedImageDestination', () => {
  it('takes same-origin paths only', () => {
    expect(isAllowedImageDestination('/files/a/b.webp')).toBe(true);
    expect(isAllowedImageDestination('https://example.com/p.png')).toBe(false);
    expect(isAllowedImageDestination('//evil.tld/p.png')).toBe(false);
    expect(isAllowedImageDestination('data:image/png;base64,AAAA')).toBe(false);
    expect(isAllowedImageDestination('')).toBe(false);
  });
});
