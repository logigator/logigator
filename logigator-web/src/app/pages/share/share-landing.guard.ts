import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { ShareLandingService } from './share-landing.service';

/**
 * Resolves the document behind a share token before the page activates, and
 * always lets it through.
 *
 * Returning `false` would answer `200` carrying whatever was rendered last, so
 * a token that names nothing is a 404 the *page* renders — status and all — and
 * a read that failed is a retry the page offers. A regenerated link has to stop
 * working, and "stopped working" is a page, not a redirect.
 */
export const shareLandingGuard: CanActivateFn = async (route) => {
  await inject(ShareLandingService).resolve(route.paramMap.get('link') ?? '');
  return true;
};
