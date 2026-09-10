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
 * Keeps an anonymous visitor out of the account's own pages, sending them to
 * the sign-in form with the page they asked for as the return path.
 *
 * The session is resolved before the first render, so this answers a server
 * render too — and a `UrlTree` from a guard becomes a real `302` there, the
 * final URL differing from the one asked for. Nothing under `my/*` is
 * indexable, so there is no soft-404 problem to weigh: the visitor lands on the
 * form and is sent back afterwards.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.user()) return true;

  return router.createUrlTree([inject(SiteLinks).login()], {
    queryParams: { [RETURN_PATH_PARAM]: state.url }
  });
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
  const destination = router.parseUrl(returnPath ?? inject(SiteLinks).home());

  // A `?error=` is carried to the destination rather than dropped with the
  // page. A signed-in visitor lands here only from a Google round trip that
  // was a *link* — the API's callback answers every failure on the configured
  // sign-in URL, whichever the flow was for — and the page that offered the
  // link is the one that has to report it failed.
  const failure = route.queryParamMap.get('error');
  if (failure) {
    destination.queryParams = { ...destination.queryParams, error: failure };
  }
  return destination;
};
