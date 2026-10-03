import { TranslationKey } from '../translation/translation-key.model';

/** What the API's OAuth callback puts in `?error=` when a round trip fails. */
const GOOGLE_ERRORS: Record<string, TranslationKey> = {
  google_failed: 'auth.googleErrors.failed',
  google_state_invalid: 'auth.googleErrors.stateInvalid',
  google_email_taken: 'auth.googleErrors.emailTaken',
  google_already_linked: 'auth.googleErrors.alreadyLinked'
};

/**
 * The message for a failed Google round trip, or `null` where there was none.
 *
 * Shared by the sign-in page and the account page: the same callback answers
 * both — a caller with a session is linking rather than signing in — so a
 * failure reads the same either way, and one of the two failures
 * (`already_linked`) can only ever happen to the account page.
 */
export function googleErrorKey(code: string | null): TranslationKey | null {
  if (!code) return null;
  return GOOGLE_ERRORS[code] ?? 'forms.errors.unknown';
}
