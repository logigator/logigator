import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { LanguageId } from '@logigator/core';
import { Changelog } from '@logigator/docs';
import { TranslationService } from '../../translation/translation.service';
import { loadChangelog } from './changelog-content';

/** A document that finished loading, and which language it is written in. */
interface LoadedChangelog {
  lang: LanguageId;
  changelog: Changelog;
}

/**
 * Holds the changelog the route resolved, so the page renders releases the
 * server already had.
 *
 * Nothing crosses through `TransferHandoffService`, for the reason the legal
 * documents do not: what it would carry is the same text a second time, where
 * the browser instead reads its language's chunk.
 */
@Injectable({ providedIn: 'root' })
export class ChangelogContentService {
  private readonly translation = inject(TranslationService);
  private readonly loaded = signal<LoadedChangelog | null>(null);

  /**
   * Loads the changelog in the document's language. Rejects, cancelling the
   * navigation, when the chunk cannot be read: a changelog with no releases is
   * worse than staying on the page the visitor is reading.
   */
  public async resolve(): Promise<void> {
    const lang = this.translation.getActiveLang();
    if (this.loaded()?.lang === lang) {
      return;
    }
    this.loaded.set({ lang, changelog: await loadChangelog(lang) });
  }

  /**
   * The releases, or none until the language they were loaded in is the one
   * the document renders in — a page drawing nothing beats one whose notes are
   * in the language the visitor just left.
   */
  public readonly releases: Signal<Changelog['releases']> = computed(() => {
    const loaded = this.loaded();
    return loaded?.lang === this.translation.activeLang()
      ? loaded.changelog.releases
      : [];
  });
}
