import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LgMarkdown } from '@logigator/ui';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationKey } from '../../translation/translation-key.model';
import { LegalContentService } from './legal-content.service';
import { LegalDocumentKind, LegalRouteData } from './legal-document';

/** Each document's own head; the body is the markdown. */
const HEADINGS: Record<
  LegalDocumentKind,
  { title: TranslationKey; lede: TranslationKey }
> = {
  imprint: { title: 'pages.imprint.title', lede: 'pages.imprint.lede' },
  'privacy-policy': {
    title: 'pages.privacyPolicy.title',
    lede: 'pages.privacyPolicy.lede'
  }
};

/**
 * The imprint and the privacy policy: the inner-page header over one column of
 * prose the route resolved.
 *
 * One component for both. They are the same page — a legal text of its own,
 * long enough to carry its own headings and, in the privacy policy's case, its
 * own table of contents — and which text it is comes from the route.
 */
@Component({
  selector: 'web-legal-page',
  imports: [LgMarkdown, TranslateDirective],
  templateUrl: './legal-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalPage {
  private readonly content = inject(LegalContentService);

  /**
   * From the route snapshot: the language can change under this page, but the
   * document it names cannot — that is a different route.
   */
  private readonly kind = (
    inject(ActivatedRoute).snapshot.data as LegalRouteData
  ).legalDocument;

  protected readonly headings = HEADINGS[this.kind];
  protected readonly markdown = this.content.markdown(this.kind);
}
