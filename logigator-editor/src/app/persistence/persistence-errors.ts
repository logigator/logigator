import { HttpErrorResponse } from '@angular/common/http';

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

export function formatHttpError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return `HTTP ${err.status} ${err.statusText}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
