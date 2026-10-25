import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { LanguageId } from '@logigator/core';
import { DocPageId } from '@logigator/docs';
import { TranslationService } from '../../translation/translation.service';
import { loadDocPage } from './doc-content';

/** A page that finished loading, and which page in which language it is. */
interface LoadedPage {
  page: DocPageId;
  lang: LanguageId;
  markdown: string;
}

/**
 * Holds the documentation page the route resolved, so the page renders text
 * the server already had.
 *
 * Nothing crosses through `TransferHandoffService`: what it would carry is that
 * same text a second time, where the browser instead reads its language's
 * chunk — one immutable request, cached past this page and this visit.
 */
@Injectable({ providedIn: 'root' })
export class DocsContentService {
  private readonly translation = inject(TranslationService);
  private readonly loaded = signal<LoadedPage | null>(null);

  /**
   * Loads `page` in the document's language. Rejects, cancelling the
   * navigation, when the chunk cannot be read: a documentation page with no
   * text is worse than staying on the page the visitor is reading.
   */
  public async resolve(page: DocPageId): Promise<void> {
    const lang = this.translation.getActiveLang();
    if (this.matches(this.loaded(), page, lang)) {
      return;
    }
    const markdown = await loadDocPage(page, lang);
    this.loaded.set({ page, lang, markdown });
  }

  /**
   * The markdown for `page`, or null until the language it was loaded in is
   * the one the document renders in — a page drawing nothing beats one whose
   * text is in the language the visitor just left.
   */
  public markdown(page: DocPageId): Signal<string | null> {
    return computed(() => {
      const loaded = this.loaded();
      return this.matches(loaded, page, this.translation.activeLang())
        ? loaded.markdown
        : null;
    });
  }

  private matches(
    loaded: LoadedPage | null,
    page: DocPageId,
    lang: string
  ): loaded is LoadedPage {
    return loaded?.page === page && loaded.lang === lang;
  }
}
