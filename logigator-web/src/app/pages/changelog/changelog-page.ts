import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { releaseInstant } from '@logigator/docs';
import { LgMarkdown } from '@logigator/ui';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { ChangelogContentService } from './changelog-content.service';

/**
 * Every release of the editor, newest first: the version and its date beside
 * the notes, which are the same markdown the editor's "what's new" dialog
 * shows.
 *
 * The page draws the release headings itself rather than letting the renderer
 * emit them, so each one carries the `id` its feed entry links to — the
 * renderer emits no heading ids anywhere. The notes below a heading start at
 * `### …`, which is what keeps the heading order intact.
 *
 * The title and the lede are this app's own translation keys, not the
 * document's `# …` and intro: the head needs both before any body is loaded,
 * and it is how the documentation pages are named too.
 */
@Component({
  selector: 'web-changelog-page',
  imports: [LgMarkdown, TranslateDirective],
  templateUrl: './changelog-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangelogPage {
  private readonly content = inject(ChangelogContentService);
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);

  protected readonly feedHref = this.links.changelogFeed;

  /** The releases with their dates written out, in the document's language. */
  protected readonly releases = computed(() => {
    const format = new Intl.DateTimeFormat(this.translation.activeLang(), {
      dateStyle: 'long',
      timeZone: 'UTC'
    });
    return this.content.releases().map((release) => ({
      ...release,
      dateLabel: format.format(new Date(releaseInstant(release.date)))
    }));
  });
}
