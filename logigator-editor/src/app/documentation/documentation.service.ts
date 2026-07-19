import { computed, inject, Injectable, signal } from '@angular/core';
import { DialogRef, DialogService } from '@logigator/ui';
import { LayoutService } from '../layout/layout.service';
import { TranslationService } from '../translation/translation.service';
import { DocumentationDialogComponent } from '../ui/dialogs/documentation-dialog/documentation-dialog.component';
import { docPage, DocPageId } from './docs-pages';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * Opens the in-editor documentation and tracks which page it shows. Anything
 * in the editor can deep link to a page via {@link open} — the Help menu, the
 * viewer's navigation, `docs:` cross links inside pages, and contextual
 * "learn more" links all funnel through it.
 *
 * The dialog is a centred card on desktop and a fullscreen takeover on the
 * compact breakpoint (live across flips, via the `fullscreen` signal). `page`
 * is `null` while no page was explicitly requested; the compact viewer shows
 * its topic index then, the desktop viewer falls back to the default page.
 */
@Injectable({ providedIn: 'root' })
export class DocumentationService {
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly layout = inject(LayoutService);
  private readonly analytics = inject(AnalyticsService);

  private readonly _page = signal<DocPageId | null>(null);
  private readonly _anchor = signal<string | null>(null);
  private dialogRef: DialogRef<unknown, DocumentationDialogComponent> | null =
    null;

  /** Page the viewer shows, or null for "none requested" (compact index). */
  public readonly page = computed(this._page);
  /** Pending heading anchor of the last {@link open}, until consumed. */
  public readonly anchor = computed(this._anchor);

  /**
   * Opens the documentation viewer on `page`, or — without one — wherever it
   * was: a fresh open lands on the topic index (compact) / default page
   * (desktop), while a call on an already open viewer changes nothing.
   */
  public open(page?: DocPageId, anchor?: string): void {
    if (page) {
      this._page.set(page);
      this._anchor.set(anchor ?? null);
    }
    if (page || !this.dialogRef) {
      this.analytics.capture(AnalyticsEvent.DocPageOpened, {
        page: page ?? 'index'
      });
    }
    if (this.dialogRef) {
      return;
    }
    this.dialogRef = this.dialogService.open(DocumentationDialogComponent, {
      header: this.translation.translate('documentation.header'),
      width: '64rem',
      style: { height: '85vh' },
      fullscreen: this.layout.isCompact,
      bodyClass: 'flex flex-col overflow-hidden',
      modal: true,
      closable: true
    });
    this.dialogRef.onClose.subscribe(() => {
      this.dialogRef = null;
      // The next open starts at the index / default page again.
      this._page.set(null);
      this._anchor.set(null);
    });
  }

  /** Returns the compact viewer to its topic index. */
  public showIndex(): void {
    this._page.set(null);
    this._anchor.set(null);
  }

  /** Marks the pending anchor as applied so re-sending the same one fires. */
  public clearAnchor(): void {
    this._anchor.set(null);
  }

  /** Markdown URL of a page for the active language, English as fallback. */
  public resolveUrl(page: DocPageId): string {
    const urls = docPage(page).urls;
    return urls[this.translation.getActiveLang()] ?? urls['en'];
  }
}
