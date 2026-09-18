import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LegalContentService } from './legal-content.service';
import { LegalRouteData } from './legal-document';

/**
 * Loads the route's legal document before the page activates, so the server
 * render carries the whole text in its first byte — a legal page is the last
 * one that should need JavaScript to be readable.
 */
export const legalContentGuard: CanActivateFn = async (route) => {
  const { legalDocument } = route.data as LegalRouteData;
  await inject(LegalContentService).resolve(legalDocument);
  return true;
};
