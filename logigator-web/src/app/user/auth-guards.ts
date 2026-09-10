import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RETURN_PATH_PARAM, safeReturnPath } from '@logigator/core';
import { SiteLinks } from '../layout/site-links';
import { AuthProvidersService } from './auth-providers.service';
import { SessionService } from './session.service';

/**
 * Loads the deployment's sign-in methods before an auth page activates, so the
 * server render already knows whether there is a Google button to draw and the
 * browser is not handed a page that grows one after hydration.
 */
export const authProvidersGuard: CanActivateFn = async () => {
  await inject(AuthProvidersService).resolve();
  return true;
};

/**
 * Keeps a signed-in visitor off the sign-in pages, sending them where they were
 * headed instead. The session is resolved before the first render, so this
 * answers a server render too — a stale link from a mail or another tab lands
 * on the destination rather than on a form the visitor has no use for.
 */
export const guestGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  if (!session.user()) return true;

  const router = inject(Router);
  const returnPath = safeReturnPath(route.queryParamMap.get(RETURN_PATH_PARAM));
  return router.parseUrl(returnPath ?? inject(SiteLinks).home());
};
