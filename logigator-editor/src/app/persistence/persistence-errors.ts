import { ApiRequestError } from '../api/api-error';

export class AuthRequiredError extends Error {
  constructor() {
    super('AuthRequired');
    this.name = 'AuthRequiredError';
  }
}

/**
 * A cloud document loaded under a different account than the one currently
 * signed in — saving it would write into the wrong account, so the save layer
 * rejects it. Like {@link AuthRequiredError}, the thrower surfaces the specific
 * toast; outer save flows treat the error as already reported.
 */
export class ForeignDocumentError extends Error {
  constructor() {
    super('ForeignDocument');
    this.name = 'ForeignDocumentError';
  }
}

/**
 * Whether a save-path error was already surfaced with a specific message at the
 * point it was raised (signed-out / foreign-account guards), so outer flows
 * must not stack a generic failure toast on top.
 */
export function isHandledSaveError(err: unknown): boolean {
  return (
    err instanceof AuthRequiredError || err instanceof ForeignDocumentError
  );
}

/**
 * A failure as a toast detail line. An {@link ApiRequestError} carries the API's
 * own message, which says more than the status ever did — a rejected document
 * names what about it did not parse.
 */
export function formatHttpError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
