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
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgPaginator,
  ToastService
} from '@logigator/ui';
import { DocumentsApiService } from '../../api/services/documents-api.service';
import { genericFailureKey } from '../../forms/api-failure';
import { SiteLinks } from '../../layout/site-links';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { EditDocumentDialog } from './dialogs/edit-document-dialog';
import { ShareDocumentDialog } from './dialogs/share-document-dialog';
import { MyDocumentTiles, type MyDocumentCommand } from './my-document-tiles';
import { MyDocumentsService, type MyDocumentRow } from './my-documents.service';
import { MY_PAGE_SIZE, myListingParams } from './my-listing-query';

/**
 * The reader's own projects or components: the grid, a filter, and the three
 * things a shelf does to a row — edit its name and description, manage its
 * share, delete it.
 *
 * The site never creates or saves a circuit. The editor has owned both since
 * Phase 4, so *New project* is a link into it rather than a form here, and a
 * library component is made out of a circuit inside the editor, which is what
 * the empty shelf of components says instead of offering a button.
 *
 * Both controls write the URL rather than component state — the guard reads it
 * back and re-resolves — so a filter and a page survive a reload and answer in
 * the server's first byte. The filter is a real `<form method="get">`; the
 * paginator is the one control that needs script.
 */
@Component({
  selector: 'web-my-documents-page',
  imports: [
    EmptyState,
    LgButton,
    LgIconField,
    LgInputIcon,
    LgInputText,
    LgPaginator,
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

  protected onCommand(command: MyDocumentCommand): void {
    switch (command.action) {
      case 'edit':
        this.openEdit(command.row);
        return;
      case 'share':
        this.openShare(command.row);
        return;
      case 'delete':
        this.confirmDelete(command.row);
    }
  }

  /**
   * Claims the submit where there is script to claim it, so filtering is a
   * router navigation rather than a document load. The form's own `action`
   * answers where there is not.
   */
  protected onSearch(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const search = new FormData(form).get('search');
    void this.router.navigate([this.path()], {
      queryParams: myListingParams({
        search: typeof search === 'string' ? search.trim() : ''
      })
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
      width: '32rem',
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
      width: '34rem',
      closeLabel: this.translation.translate('common.close'),
      data: {
        kind: this.kind(),
        id: row.id,
        name: row.name,
        link: row.link,
        public: row.public
      }
    });
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
