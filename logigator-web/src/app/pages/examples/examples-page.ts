import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { LgButton } from '@logigator/ui';
import { CircuitPreview } from '../../documents/circuit-preview';
import { SiteLinks } from '../../layout/site-links';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { ExamplesContentService } from './examples-content.service';

/**
 * The seed account's circuits, one row each: the render beside the description
 * that teaches it, sides alternating down the page.
 *
 * A row is not a tile. The tile is the shape a list of somebody's circuits
 * takes — the home page's shelf, community browse, my area — and it has no
 * room for a description; here the description *is* the page, so the preview
 * becomes a figure beside it.
 */
@Component({
  selector: 'web-examples-page',
  imports: [
    CircuitPreview,
    EmptyState,
    LgButton,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './examples-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExamplesPage {
  private readonly content = inject(ExamplesContentService);
  private readonly links = inject(SiteLinks);

  protected readonly examples = this.content.examples;

  /**
   * An example opens in the editor by its share link, which needs no session,
   * and there is no page on this site to open instead.
   */
  protected readonly rows = computed(() =>
    (this.examples.entries() ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      preview: row.preview,
      href: this.links.editorShare(row.link)
    }))
  );

  /** The wide half of the row, so the browser picks a rung for the frame. */
  protected readonly PREVIEW_SIZES = '(min-width: 768px) 304px, 100vw';

  /**
   * Which side the figure takes, as the row's own grid template: the fixed
   * column has to be the one the figure lands in, so a row that only reordered
   * its children would leave the description in a 19rem column.
   */
  protected rowClass(even: boolean): string {
    return (
      'grid gap-6 border-t border-border py-8 md:items-center md:gap-10 md:py-11 ' +
      (even
        ? 'md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]'
        : 'md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]')
    );
  }

  protected figureClass(even: boolean): string {
    return even ? '' : 'md:order-2';
  }
}
