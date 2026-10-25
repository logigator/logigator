/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocsLink } from './doc-link';
import { DOC_PAGE_IDS, DocPageId, isDocPageId } from './docs-structure';
import { docHeadings } from './heading-id';

const PAGES = join(import.meta.dirname, 'pages');

const LANGUAGES = readdirSync(PAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const DOCUMENTS = DOC_PAGE_IDS.flatMap((page) =>
  LANGUAGES.map((lang) => ({ page, lang }))
);

function source(page: DocPageId, lang: string): string {
  return readFileSync(join(PAGES, lang, `${page}.md`), 'utf8');
}

function ids(page: DocPageId, lang: string): (string | null)[] {
  return docHeadings(source(page, lang))
    .filter((heading) => heading.level > 1)
    .map((heading) => heading.id);
}

/** Every `](destination)` a page authors, in source order. */
function destinations(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)\s]+)/g)].map((match) => match[1]);
}

describe('the documentation pages', () => {
  /**
   * An id is written into URLs and matched as typed, so it stays a plain
   * ASCII slug that neither the renderer nor a URL encoder rewrites.
   */
  it.each(DOCUMENTS)(
    'give every section of $page/$lang a unique id',
    ({ page, lang }) => {
      const own = ids(page, lang);

      for (const id of own) {
        expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
      expect(new Set(own).size).toBe(own.length);
    }
  );

  it.each(DOCUMENTS.filter(({ lang }) => lang !== 'en'))(
    'lay out $page/$lang under the English ids',
    ({ page, lang }) => {
      const outline = (of: string) =>
        docHeadings(source(page, of)).map(({ level, id }) => ({ level, id }));

      expect(outline(lang)).toEqual(outline('en'));
    }
  );

  it.each(DOCUMENTS)(
    'link from $page/$lang only to pages and sections that exist',
    ({ page, lang }) => {
      const broken: string[] = [];
      for (const destination of destinations(source(page, lang))) {
        const target = destination.startsWith('#')
          ? { page, anchor: destination.slice(1) }
          : parseDocsLink(destination);
        if (!target) {
          continue;
        }
        if (
          !isDocPageId(target.page) ||
          (target.anchor !== undefined &&
            !ids(target.page, lang).includes(target.anchor))
        ) {
          broken.push(destination);
        }
      }

      expect(broken).toEqual([]);
    }
  );
});
