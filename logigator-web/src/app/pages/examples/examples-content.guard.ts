import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ExamplesContentService } from './examples-content.service';

/**
 * Resolves the examples before the page activates, so the server render emits
 * the rows. Never blocks the route: a failed read resolves to its own error
 * state.
 */
export const examplesContentGuard: CanActivateFn = async () => {
  await inject(ExamplesContentService).resolve();
  return true;
};
