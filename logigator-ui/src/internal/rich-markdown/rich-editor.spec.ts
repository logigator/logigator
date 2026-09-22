import { describe, expect, it } from 'vitest';
import { renderUserMarkdown } from '../user-markdown';
import { createRichEditor } from './rich-editor';

/**
 * One document carrying every block the toolbar can make, so the two
 * renderings are compared over the whole vocabulary rather than a paragraph.
 */
const SAMPLE = [
  '# Heading one',
  '',
  'A paragraph with **bold**, _italic_, `code` and a [link](https://example.com).',
  '',
  '## Heading two',
  '',
  '- first item',
  '- second item',
  '',
  '1. one',
  '2. two',
  '',
  '> a quote',
  '',
  '```js',
  'const x = 1;',
  '```',
  '',
  '---',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '### Heading three'
].join('\n');

async function richHtml(markdown: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const editor = await createRichEditor({
    root,
    value: markdown,
    editable: () => true,
    surfaceClass: () => '',
    linkText: 'link',
    onChange: () => undefined,
    onStateChange: () => undefined
  });
  const html = root.querySelector('.lg-rich-surface')?.innerHTML ?? '';
  editor.destroy();
  root.remove();
  return html;
}

/**
 * The blocks a rendering is made of, in order.
 *
 * A heading is named by the level that was **written**, not by its tag: the
 * page's renderer moves a member's headings two levels down so a description
 * cannot put an `h1` on somebody else's page, and the editor's numbers them
 * from one. `data-level` is what both emit and what the stylesheet sizes
 * them by, so it is what the two have to agree about.
 */
function blocks(html: string): string[] {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return Array.from(holder.children).map((element) => {
    const level = element.getAttribute('data-level');
    return level ? `heading:${level}` : element.tagName.toLowerCase();
  });
}

/** The inline markup inside the first paragraph, in order. */
function inlines(html: string): string[] {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return Array.from(holder.querySelector('p')?.children ?? []).map((element) =>
    element.tagName.toLowerCase()
  );
}

describe('the rich editor against the page', () => {
  /**
   * The point of editing in place is that an author is looking at the page.
   * These two renderings come from different parsers — marked writes the one a
   * reader gets, ProseMirror the one an author types into — and one stylesheet
   * draws both, so a block either side stopped emitting would be styled by
   * rules written for the other.
   */
  it('builds the same blocks the page builds', async () => {
    const rich = await richHtml(SAMPLE);
    expect(blocks(rich)).toEqual(blocks(renderUserMarkdown(SAMPLE)));
  });

  it('builds the same inline markup the page builds', async () => {
    const rich = await richHtml(SAMPLE);
    expect(inlines(rich)).toEqual(inlines(renderUserMarkdown(SAMPLE)));
  });

  /**
   * Where the two genuinely differ, and why the shared stylesheet zeroes the
   * bottom margin of the last block in a cell or an item: the editor's
   * document model has no inline-only container, so a tight list item and
   * every table cell hold a paragraph that the page's renderer does not emit.
   * A rule written for one would otherwise open a gap in the other.
   */
  it('wraps cell and item content in a paragraph, which the page does not', async () => {
    const rich = await richHtml('- one\n\n| A |\n| --- |\n| 1 |');
    const holder = document.createElement('div');
    holder.innerHTML = rich;

    expect(holder.querySelector('li')?.firstElementChild?.tagName).toBe('P');
    expect(holder.querySelector('td')?.firstElementChild?.tagName).toBe('P');

    const page = document.createElement('div');
    page.innerHTML = renderUserMarkdown('- one\n\n| A |\n| --- |\n| 1 |');
    expect(page.querySelector('li')?.firstElementChild).toBeNull();
    expect(page.querySelector('td')?.firstElementChild).toBeNull();
  });
});
