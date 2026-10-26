import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { lastPageUrl, listingQuery } from './listing-query';
import { ProfileSection, ProfileService } from './profile.service';

/** What a profile tab's route says about itself. */
export interface ProfileRouteData {
  profileSection: ProfileSection;
}

/**
 * Resolves the member before the page activates, so the header is in the first
 * byte. On the parent route, since all four tabs show the same header and
 * switching between them must not re-read it.
 */
export const profileGuard: CanActivateFn = async (route) => {
  await inject(ProfileService).resolveProfile(userIdOf(route));
  return true;
};

/**
 * Resolves the tab's own listing. On each child route, which is what makes a
 * tab a real URL: it renders server-side, it is what a crawler follows, and it
 * carries its own canonical and `hreflang` set.
 */
export const profileListingGuard: CanActivateFn = async (route, state) => {
  const section = (route.data as Partial<ProfileRouteData>).profileSection;
  if (!section) {
    throw new Error('A profile tab must declare its `profileSection`.');
  }
  const profiles = inject(ProfileService);
  const router = inject(Router);
  await profiles.resolveListing(
    userIdOf(route),
    section,
    listingQuery(route).page
  );
  return profiles.pastLastPage()
    ? lastPageUrl(router, state.url, profiles.pageCount())
    : true;
};

/** The id is the parent route's parameter, so a child has to walk up for it. */
function userIdOf(route: ActivatedRouteSnapshot): string {
  for (
    let current: ActivatedRouteSnapshot | null = route;
    current;
    current = current.parent
  ) {
    const id = current.paramMap.get('id');
    if (id) return id;
  }
  return '';
}
