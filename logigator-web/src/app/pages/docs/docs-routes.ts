import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { DOC_SECTIONS, DocPageId, docPageSummary } from '@logigator/docs';
import { PageMeta } from '../../seo/seo.service';
import { DocPage } from './doc-page';
import { DocsIndexPage } from './docs-index-page';
import { docsContentGuard } from './docs-content.guard';
import { docsSearchGuard } from './docs-search.guard';
import { DocsRouteData } from './docs-route-data';
import { DOC_PAGE_TITLES } from './doc-titles';
import { DocsContentService } from './docs-content.service';

/** Where the trail names the index, above every page under it. */
const DOCS_TRAIL: PageMeta['ancestors'] = [
  { titleKey: 'pages.docs.title', path: '/docs' }
];

/** The markdown the route's guard resolved, in the document's language. */
const pageMarkdown = (page: DocPageId): string | null =>
  inject(DocsContentService).markdown(page)();

/**
 * The index and one route per page, generated from the shared tree.
 *
 * A route each rather than `docs/:id`: the title, the trail and the markdown
 * twin are then static route data the way every other page's are, and an id
 * that names no page falls through to the 404 — with its status — instead of
 * needing a matcher to reject it.
 */
export const docsRoutes: Routes = [
  {
    path: 'docs',
    component: DocsIndexPage,
    canActivate: [docsSearchGuard],
    data: {
      seo: {
        titleKey: 'pages.docs.title',
        descriptionKey: 'pages.docs.lede'
      } satisfies PageMeta
    }
  },
  ...DOC_SECTIONS.flatMap((section) =>
    section.pages.map((page) => ({
      path: `docs/${page}`,
      component: DocPage,
      canActivate: [docsContentGuard],
      data: {
        docPage: page,
        seo: {
          titleKey: DOC_PAGE_TITLES[page],
          // The page's own opening paragraph, which the guard has already
          // loaded — eleven pages sharing the site's description is the
          // duplicate a search engine reports, and eleven more locale keys
          // would be the same sentence written twice.
          description: () => docPageSummary(pageMarkdown(page)),
          ancestors: DOCS_TRAIL,
          markdownPath: `/docs/${page}.md`
        } satisfies PageMeta
      } satisfies DocsRouteData & { seo: PageMeta }
    }))
  )
];
