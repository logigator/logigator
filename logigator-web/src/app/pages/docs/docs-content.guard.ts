import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { DocsRouteData } from './docs-route-data';
import { DocsContentService } from './docs-content.service';

/**
 * Loads the route's documentation page before it activates, so the server
 * render carries the whole text in its first byte and a crawler reads the
 * prose rather than an empty shell.
 */
export const docsContentGuard: CanActivateFn = async (route) => {
  const { docPage } = route.data as DocsRouteData;
  await inject(DocsContentService).resolve(docPage);
  return true;
};
