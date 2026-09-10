import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOC_SECTIONS, DocPageId } from '@logigator/docs';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { DOC_PAGE_TITLES, DOC_SECTION_TITLES } from './doc-titles';
import { DocsSearchField } from './docs-search-field';

/**
 * The topic tree beside a documentation page: every section and every page,
 * as real links.
 *
 * Links rather than the editor's `lg-navigation`, which draws buttons — a
 * crawler following these is the reason the pages are on the site, and eleven
 * pages that only reveal one another through JavaScript would publish nothing
 * the SPA viewer does not already keep to itself.
 */
@Component({
  selector: 'web-docs-nav',
  imports: [DocsSearchField, RouterLink, TranslateDirective],
  templateUrl: './docs-nav.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsNav {
  private readonly links = inject(SiteLinks);

  /** The page being read, marked in the tree. */
  public readonly current = input<DocPageId>();

  protected readonly sections = DOC_SECTIONS;
  protected readonly sectionTitles = DOC_SECTION_TITLES;
  protected readonly pageTitles = DOC_PAGE_TITLES;

  /**
   * Every page's path, in one computed rather than a signal per link: the
   * language is part of the path, so all eleven move together when the
   * document switches to another one.
   */
  protected readonly hrefs = computed(() =>
    Object.fromEntries(
      DOC_SECTIONS.flatMap((section) =>
        section.pages.map((page) => [page, this.links.docsPage(page)])
      )
    )
  );

  protected readonly indexHref = this.links.docs;
}
