import { ApiRequestError } from '../api/api-error';

export class AuthRequiredError extends Error {
  constructor() {
    super('AuthRequired');
    this.name = 'AuthRequiredError';
  }
}

/**
 * A cloud document loaded under a different account than the one signed in;
 * saving it would write into the wrong account. Like {@link AuthRequiredError},
 * the thrower has already toasted the specific reason.
 */
export class ForeignDocumentError extends Error {
  constructor() {
    super('ForeignDocument');
    this.name = 'ForeignDocumentError';
  }
}

/**
 * Whether a save-path error was already surfaced where it was raised, so outer
 * flows must not stack a generic failure toast on top.
 */
export function isHandledSaveError(err: unknown): boolean {
  return (
    err instanceof AuthRequiredError || err instanceof ForeignDocumentError
  );
}

/**
 * A failure as a toast detail line. An {@link ApiRequestError} carries the
 * API's own message, so a rejected document names what did not parse.
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
