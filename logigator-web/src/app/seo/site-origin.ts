import { InjectionToken } from '@angular/core';

/**
 * The origin the site is reachable at from outside, e.g.
 * `https://logigator.com`. Canonical and `hreflang` URLs must be absolute and
 * must name the public host, which a server render behind a proxy cannot infer
 * from the request it received — hence a value the deployment supplies.
 */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN');
