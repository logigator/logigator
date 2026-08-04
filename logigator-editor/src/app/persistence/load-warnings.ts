import { ToastService } from '../logging/toast.service';
import { TranslationService } from '../translation/translation.service';

/**
 * Surfaces the aggregated "custom components were skipped" warning for a
 * decoded document. The file codec owns no UI — it reports the count of
 * customs dropped for a missing snapshot — so every load entry point funnels
 * that count through here, keeping the user-facing message uniform.
 */
export function warnSkippedCustoms(
  toast: ToastService,
  translation: TranslationService,
  count: number,
  context: string
): void {
  if (count === 0) return;
  toast.warn(
    count === 1
      ? translation.translate('persistence.skippedCustomOne')
      : translation.translate('persistence.skippedCustomMany', { count }),
    context
  );
}
