import { ToastService } from '../logging/toast.service';
import { TranslationService } from '../translation/translation.service';

/**
 * The aggregated "custom components were skipped" warning. The file codec owns
 * no UI, so every load entry point funnels its count through here.
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
