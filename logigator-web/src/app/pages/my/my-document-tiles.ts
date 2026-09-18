import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output
} from '@angular/core';
import {
  LgCircuitTile,
  LgCircuitTileActions,
  LgCircuitTileLink,
  LgCircuitTileMeta,
  LgMenu,
  LgTag,
  type MenuItem
} from '@logigator/ui';
import type { CommunityKind } from '../../api/services/community-api.service';
import { SiteLinks } from '../../layout/site-links';
import { ThemingService } from '../../theming/theming.service';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import type { MyDocumentRow } from './my-documents.service';

/** Which control on a row was chosen, for the page that owns the dialogs. */
export type MyDocumentAction = 'edit' | 'share' | 'delete';

export interface MyDocumentCommand {
  action: MyDocumentAction;
  row: MyDocumentRow;
}

/**
 * The reader's own documents as a grid of tiles.
 *
 * The same `lg-circuit-tile` the community listings draw, filled differently:
 * an author and a star count say nothing on a shelf where every row is the
 * reader's, so the meta row states what does — whether the document is
 * published, and when it was last edited — and the corner carries the controls
 * for the three things a shelf can do to a row.
 *
 * The card itself opens the editor, which is a separate deployment sharing this
 * origin, so its link is a real `href` rather than a route.
 *
 * The theme's preview is picked here rather than by the markup: both themes are
 * separate renders and no `<picture>` can negotiate a colour scheme, so hiding
 * one with CSS would download both.
 */
@Component({
  selector: 'web-my-document-tiles',
  imports: [
    LgCircuitTile,
    LgCircuitTileActions,
    LgCircuitTileLink,
    LgCircuitTileMeta,
    LgMenu,
    LgTag,
    TranslateDirective
  ],
  host: { class: 'block' },
  template: `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" *webTranslate="let t">
      @for (tile of tiles(); track tile.id) {
        <!-- The menu is a sibling of the tile rather than content of it: the
             tile projects only the slots it names, and anything else it is
             handed is dropped. The flex wrapper is what keeps the card the
             full height of its grid row. -->
        <div class="flex">
          <lg-circuit-tile
            class="grow"
            [name]="tile.name"
            [preview]="tile.preview"
            [loading]="tile.loading"
          >
            <a
              lgCircuitTileLink
              [href]="tile.editorHref"
              [attr.aria-label]="
                t('pages.my.list.openInEditor', { name: tile.name })
              "
            ></a>

            <span lgCircuitTileMeta>
              <lg-tag [severity]="tile.public ? 'success' : 'secondary'">
                {{
                  tile.public
                    ? t('pages.my.list.public')
                    : t('pages.my.list.private')
                }}
              </lg-tag>
              <span class="truncate font-mono text-xs">{{ tile.edited }}</span>
            </span>

            <button
              lgCircuitTileActions
              type="button"
              class="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-content/90 text-muted hover:bg-content-hover hover:text-text focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary"
              [attr.aria-label]="
                t('pages.my.list.actionsFor', { name: tile.name })
              "
              (click)="menu.toggle($event)"
            >
              <i
                class="ph ph-dots-three-vertical text-lg"
                aria-hidden="true"
              ></i>
            </button>
          </lg-circuit-tile>

          <lg-menu #menu [model]="tile.menu" />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyDocumentTiles {
  private readonly theming = inject(ThemingService);
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);

  readonly rows = input.required<readonly MyDocumentRow[]>();
  readonly kind = input.required<CommunityKind>();

  readonly action = output<MyDocumentCommand>();

  /** The widest the grid gets, which is where a whole row is above the fold —
   * a shelf being the first thing its page draws below the control bar. */
  private readonly EAGER_ROW = 4;

  /** A calendar date, written in UTC: a zone west of midnight names the day
   * before, and an edit date is not a moment the reader cares about. */
  private readonly dates = computed(
    () =>
      new Intl.DateTimeFormat(this.translation.activeLang(), {
        dateStyle: 'medium',
        timeZone: 'UTC'
      })
  );

  protected readonly tiles = computed(() => {
    const dark = this.theming.isDark();
    const dates = this.dates();
    const kind = this.kind();

    return this.rows().map((row, index) => ({
      id: row.id,
      name: row.name,
      public: row.public,
      edited: dates.format(new Date(row.lastEditedAt)),
      editorHref: this.links.editorDocument(kind, row.id),
      loading: index < this.EAGER_ROW ? ('eager' as const) : ('lazy' as const),
      preview: row.preview
        ? dark
          ? row.preview.dark
          : row.preview.light
        : null,
      menu: this.menuFor(row)
    }));
  });

  private menuFor(row: MyDocumentRow): MenuItem[] {
    return [
      {
        label: this.translation.translate('pages.my.list.edit'),
        icon: 'ph ph-pencil-simple',
        command: () => this.action.emit({ action: 'edit', row })
      },
      {
        label: this.translation.translate('pages.my.list.share'),
        icon: 'ph ph-share-network',
        command: () => this.action.emit({ action: 'share', row })
      },
      { separator: true },
      {
        label: this.translation.translate('pages.my.list.delete'),
        icon: 'ph ph-trash',
        styleClass: 'text-error',
        command: () => this.action.emit({ action: 'delete', row })
      }
    ];
  }
}
