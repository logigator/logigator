import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { LanguageId } from '@logigator/core';
import { TranslationService } from '../../translation/translation.service';
import { LegalDocumentKind, loadLegalDocument } from './legal-document';

/** A document that finished loading, and what it is a copy of. */
interface LoadedDocument {
  kind: LegalDocumentKind;
  lang: LanguageId;
  markdown: string;
}

/**
 * Holds the legal document the route resolved, so the page renders text the
 * server already had.
 *
 * Nothing crosses through `TransferHandoffService` here: what it holds would
 * be the document's own text a second time, where the browser instead reads
 * its language's chunk — one immutable request, cached past this page and this
 * visit.
 */
@Injectable({ providedIn: 'root' })
export class LegalContentService {
  private readonly translation = inject(TranslationService);
  private readonly loaded = signal<LoadedDocument | null>(null);

  /** Loads `kind` in the document's language. Rejects, cancelling the
   * navigation, when the chunk cannot be read: a legal page with no text is
   * worse than staying on the page the visitor is reading. */
  public async resolve(kind: LegalDocumentKind): Promise<void> {
    const lang = this.translation.getActiveLang();
    if (this.matches(this.loaded(), kind, lang)) {
      return;
    }
    const markdown = await loadLegalDocument(kind, lang);
    this.loaded.set({ kind, lang, markdown });
  }

  /**
   * The markdown for `kind`, or null until the language it was loaded in is
   * the one the document renders in — a page drawing nothing beats one whose
   * legal text is in the language the visitor just left.
   */
  public markdown(kind: LegalDocumentKind): Signal<string | null> {
    return computed(() => {
      const loaded = this.loaded();
      return this.matches(loaded, kind, this.translation.activeLang())
        ? loaded.markdown
        : null;
    });
  }

  private matches(
    loaded: LoadedDocument | null,
    kind: LegalDocumentKind,
    lang: LanguageId
  ): loaded is LoadedDocument {
    return loaded?.kind === kind && loaded.lang === lang;
  }
}
