import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_META,
  BuiltInComponentType,
  ComponentCategory,
  CUSTOM_TYPE_ID_BASE
} from '@logigator/core';
import { DocPageId, docHeadings } from '@logigator/docs';
import { HINTS } from '../onboarding/hints/registry';
import { componentDocs } from './component-docs';
import { DOCS_LINKS } from './docs-links';
import { DocsTarget } from './docs-target';

/**
 * The spec bundle cannot import `node:fs`, and the editor's `.md` imports are
 * URLs there, so the pages are read through the Node runtime the runner is.
 */
interface NodeRuntime {
  cwd(): string;
  getBuiltinModule(id: 'node:fs'): {
    readFileSync(path: string, encoding: 'utf8'): string;
  };
  getBuiltinModule(id: 'node:module'): {
    createRequire(from: string): { resolve(id: string): string };
  };
}

const node = (globalThis as unknown as { process: NodeRuntime }).process;
const docsRoot = node
  .getBuiltinModule('node:module')
  .createRequire(`${node.cwd()}/`)
  .resolve('@logigator/docs/package.json')
  .replace(/package\.json$/, '');

/**
 * The section ids of a page. Every language carries the English page's ids
 * (the docs package checks that), so the English page stands for all four.
 */
function sectionIds(page: DocPageId): string[] {
  const markdown = node
    .getBuiltinModule('node:fs')
    .readFileSync(`${docsRoot}src/pages/en/${page}.md`, 'utf8');
  return docHeadings(markdown)
    .filter((heading) => heading.level > 1)
    .flatMap((heading) => (heading.id ? [heading.id] : []));
}

function expectResolves(target: DocsTarget): void {
  if (target.anchor !== undefined) {
    expect(sectionIds(target.page)).toContain(target.anchor);
  }
}

/** The page each palette category's components are documented on. */
const CATEGORY_PAGES: Partial<Record<ComponentCategory, DocPageId>> = {
  [ComponentCategory.LOGIC_GATES]: 'logic-gates',
  [ComponentCategory.ADDERS_SELECTORS]: 'adders-and-selectors',
  [ComponentCategory.MEMORY]: 'memory',
  [ComponentCategory.TIMING]: 'clock-and-timing',
  [ComponentCategory.INPUTS]: 'inputs',
  [ComponentCategory.OUTPUTS]: 'outputs'
};

describe('documentation links', () => {
  it.each(BUILT_IN_META.map((meta) => ({ meta, type: meta.type })))(
    'documents built-in type $type at a section that exists',
    ({ meta }) => {
      const target = componentDocs(meta.type);
      expect(target?.anchor).toBeDefined();
      expectResolves(target!);
    }
  );

  it('documents a palette component on its category page', () => {
    // The tunnel sits among the logic gates but is explained with the wires.
    const elsewhere = new Set<number>([BuiltInComponentType.TUNNEL]);
    for (const meta of BUILT_IN_META) {
      const page = CATEGORY_PAGES[meta.category];
      if (page && !elsewhere.has(meta.type)) {
        expect(componentDocs(meta.type)?.page, meta.name).toBe(page);
      }
    }
  });

  it('documents every custom component at a section that exists', () => {
    const target = componentDocs(CUSTOM_TYPE_ID_BASE + 7);
    expect(target).not.toBeNull();
    expectResolves(target!);
  });

  it.each(Object.entries(DOCS_LINKS))(
    'resolves the %s link',
    (_name, target) => {
      expectResolves(target);
    }
  );

  it.each(HINTS.filter((hint) => hint.docs).map((hint) => [hint.id, hint]))(
    'resolves the %s hint link',
    (_id, hint) => {
      expectResolves(hint.docs!);
    }
  );
});
