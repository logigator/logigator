import { ApiRequestError } from '@logigator/contract';
import { TranslationKey } from '../translation/translation-key.model';

/**
 * The form-level message for a failure the page has no specific answer to.
 * Pages branch on the codes they can act on — bad credentials, a taken address,
 * a dead token — and hand everything else here, so no form ends a failed submit
 * with nothing to show.
 */
export function genericFailureKey(error: unknown): TranslationKey {
  if (!(error instanceof ApiRequestError)) return 'forms.errors.unknown';

  switch (error.code) {
    case 'rate_limited':
      return 'forms.errors.rateLimited';
    case 'service_unavailable':
      return 'forms.errors.serviceUnavailable';
    case 'validation_failed':
      return 'forms.errors.validationFailed';
    default:
      // Status 0 is what a request that never reached the server looks like:
      // offline, or a proxy that dropped it.
      return error.status === 0
        ? 'forms.errors.network'
        : 'forms.errors.unknown';
  }
}
