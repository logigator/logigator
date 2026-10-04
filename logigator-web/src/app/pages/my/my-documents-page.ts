import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmationService,
  DialogService,
  LgButton,
  LgPaginator,
  ToastService
} from '@logigator/ui';
import { DocumentsApiService } from '../../api/services/documents-api.service';
import { genericFailureKey } from '../../forms/api-failure';
import { SiteLinks } from '../../layout/site-links';
import { ListingSearch } from '../../listings/listing-search';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { CreateDocumentDialog } from './dialogs/create-document-dialog';
import { EditDocumentDialog } from './dialogs/edit-document-dialog';
import { ShareDocumentDialog } from './dialogs/share-document-dialog';
import { MyDocumentTiles, type MyDocumentCommand } from './my-document-tiles';
import { MyDocumentsService, type MyDocumentRow } from './my-documents.service';
import { MY_PAGE_SIZE, myListingParams } from './my-listing-query';

/**
 * The reader's own projects or components: the grid, a filter, and what a
 * shelf does with a row — create an empty one, edit its name and description,
 * manage its share, open its community page, delete it.
 *
 * The site never saves a circuit: the editor has owned that since Phase 4. A
 * new document is made here with no circuit at all, the API taking a create
 * without one, and the editor is where its tile opens.
 *
 * Both controls write the URL rather than component state — the guard reads it
 * back and re-resolves — so a filter and a page survive a reload and answer in
 * the server's first byte. The filter is a real `<form method="get">`, and
 * where there is script typing in it is what searches — see `ListingSearch`;
 * the paginator is the one control that needs script.
 */
@Component({
  selector: 'web-my-documents-page',
  imports: [
    EmptyState,
    LgButton,
    LgPaginator,
    ListingSearch,
    MyDocumentTiles,
    RouterLink,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './my-documents-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyDocumentsPage {
  private readonly documents = inject(MyDocumentsService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly dialogs = inject(DialogService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);

  protected readonly links = inject(SiteLinks);
  protected readonly kind = this.documents.kind;
  protected readonly query = this.documents.query;
  protected readonly rows = this.documents.rows;
  protected readonly total = this.documents.total;
  protected readonly pageCount = this.documents.pageCount;
  protected readonly failureKey = this.documents.failureKey;
  protected readonly retrying = this.documents.retrying;
  protected readonly pageSize = MY_PAGE_SIZE;

  protected readonly isProjects = computed(() => this.kind() === 'projects');

  /** The page's own path: what the form posts to and the paginator writes. */
  protected readonly path = computed(() =>
    this.isProjects() ? this.links.myProjects() : this.links.myComponents()
  );

  /** A filter that matched nothing is a different state from an empty shelf,
   * and the two get different words and different actions. */
  protected readonly searched = computed(() => this.query().search.length > 0);

  /** Per locale, so a four-digit count is grouped the way the reader writes it. */
  protected readonly totalLabel = computed(() =>
    new Intl.NumberFormat(this.translation.activeLang()).format(
      this.total() ?? 0
    )
  );

  /**
   * Opens the create dialog, which puts the new row on the grid itself. Where
   * the grid is a search or a later page, that is not where a new document is
   * drawn, so the reader is taken to the unfiltered first page — the edit-time
   * order puts it at the head of it.
   */
  protected async openCreate(): Promise<void> {
    const ref = this.dialogs.open(CreateDocumentDialog, {
      header: this.translation.translate(
        this.isProjects()
          ? 'pages.my.create.headingProject'
          : 'pages.my.create.headingComponent'
      ),
      width: '40rem',
      closeLabel: this.translation.translate('common.close'),
      data: { kind: this.kind() }
    });

    const created = await firstValueFrom(ref.onClose);
    if (!created) return;

    this.toasts.add({
      severity: 'success',
      summary: this.translation.translate('pages.my.create.done', {
        name: created.name
      })
    });
    if (this.searched() || this.query().page > 0) {
      await this.router.navigate([this.path()]);
    }
  }

  protected onCommand(command: MyDocumentCommand): void {
    switch (command.action) {
      case 'edit':
        this.openEdit(command.row);
        return;
      case 'share':
        this.openShare(command.row);
        return;
      case 'community':
        void this.openCommunityPage(command.row);
        return;
      case 'delete':
        this.confirmDelete(command.row);
    }
  }

  /**
   * What the field asks for, on the URL. Replaced rather than pushed: typing is
   * not a trail of history entries, and the back button belongs to wherever the
   * reader came from rather than to the word they were halfway through.
   */
  protected onSearch(search: string): void {
    void this.router.navigate([this.path()], {
      queryParams: myListingParams({ search }),
      replaceUrl: true
    });
  }

  protected async toPage(page: number): Promise<void> {
    await this.router.navigate([this.path()], {
      queryParams: myListingParams({ page, search: this.query().search })
    });
  }

  protected retry(): Promise<void> {
    return this.documents.retry();
  }

  protected tabClass(active: boolean): string {
    return (
      'rounded-md px-3 py-1.5 text-sm font-medium ' +
      (active
        ? 'bg-content-hover text-text-hover'
        : 'text-muted hover:bg-content-hover hover:text-text')
    );
  }

  private openEdit(row: MyDocumentRow): void {
    this.dialogs.open(EditDocumentDialog, {
      header: this.translation.translate('pages.my.edit.heading'),
      width: '40rem',
      closeLabel: this.translation.translate('common.close'),
      data: {
        kind: this.kind(),
        id: row.id,
        name: row.name,
        description: row.description
      }
    });
  }

  private openShare(row: MyDocumentRow): void {
    this.dialogs.open(ShareDocumentDialog, {
      header: this.translation.translate('pages.my.share.heading'),
      // The width the editor's share dialog opens at, because the two are one
      // dialog in two apps. This one used to be 2rem wider to fit the picker at
      // its larger size step; the picker takes the smaller step in both now.
      width: '32rem',
      closeLabel: this.translation.translate('common.close'),
      data: {
        kind: this.kind(),
        id: row.id,
        name: row.name,
        link: row.link,
        visibility: row.visibility
      }
    });
  }

  /**
   * The document's own page, which is a route of this app rather than a link
   * out: the shelf's card opens the editor, so this is the only way from here
   * to what a recipient of the link sees. It resolves whatever the state is —
   * a private document's link resolves for its owner alone, and the owner is
   * who is reading this.
   */
  private openCommunityPage(row: MyDocumentRow): Promise<boolean> {
    return this.router.navigateByUrl(
      this.links.communityDocument(this.kind(), row.link)
    );
  }

  /**
   * Deleting takes the circuit with the row, and there is no undo anywhere
   * behind it — so it asks, and the message names what is about to go.
   */
  private confirmDelete(row: MyDocumentRow): void {
    this.confirmations.confirm({
      header: this.translation.translate('pages.my.delete.heading'),
      message: this.translation.translate(
        this.isProjects()
          ? 'pages.my.delete.messageProject'
          : 'pages.my.delete.messageComponent',
        { name: row.name }
      ),
      acceptLabel: this.translation.translate('pages.my.delete.confirm'),
      rejectLabel: this.translation.translate('pages.my.delete.cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => void this.deleteRow(row)
    });
  }

  private async deleteRow(row: MyDocumentRow): Promise<void> {
    try {
      await firstValueFrom(this.documentsApi.delete(this.kind(), row.id));
    } catch (error) {
      this.toasts.add({
        severity: 'danger',
        summary: this.translation.translate('pages.my.delete.failed', {
          name: row.name
        }),
        detail: this.translation.translate(genericFailureKey(error))
      });
      return;
    }

    this.documents.dropRow(row.id);
    this.toasts.add({
      severity: 'success',
      summary: this.translation.translate('pages.my.delete.done', {
        name: row.name
      })
    });

    // The last row of a later page just went: staying there would draw the
    // empty state over a shelf that still has documents on it.
    if (this.rows()?.length === 0 && this.query().page > 0) {
      await this.toPage(this.query().page - 1);
    }
  }
}
