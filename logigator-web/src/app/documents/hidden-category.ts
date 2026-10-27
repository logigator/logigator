import type { DocumentReportReason } from '@logigator/contract';
import type { TranslationService } from '../translation/translation.service';

/**
 * What an automatic hide is named to its owner: the report form's label for
 * the same reason, in the page's language. The machine names no category only
 * if an older API answered, and `other` is the honest label then.
 */
export function hiddenCategoryLabel(
  translation: TranslationService,
  category: DocumentReportReason | null
): string {
  return translation.translate(
    `pages.community.report.reasons.${category ?? 'other'}`
  );
}
