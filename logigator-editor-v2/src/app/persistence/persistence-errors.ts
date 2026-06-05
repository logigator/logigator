import { HttpErrorResponse } from '@angular/common/http';

export class AuthRequiredError extends Error {
  constructor() {
    super('AuthRequired');
    this.name = 'AuthRequiredError';
  }
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
