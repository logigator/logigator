import { inject, Injectable, Type } from '@angular/core';
import { ProjectRoute } from './routes/project.route';
import { ComponentRoute } from './routes/component.route';
import {
  LegacyShareRoute,
  ShareComponentRoute,
  ShareProjectRoute
} from './routes/share.route';
import { LocalProjectRoute } from './routes/local-project.route';
import { Route } from './route.model';
import { DOCUMENT, Location } from '@angular/common';
import { parse } from 'regexparam';
import { RouteKeys } from './route-keys.model';
import { canonicalizeAddress } from './editor-location-strategy';
import { TranslationService } from '../translation/translation.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';

const ROUTES: Type<Route>[] = [
  ProjectRoute,
  ComponentRoute,
  // One entry per kind, so a path naming a kind is matched by a pattern rather
  // than claimed by a parameter and judged when the route runs.
  ShareProjectRoute,
  ShareComponentRoute,
  // After the kind-carrying routes: the two take different numbers of segments,
  // so neither can shadow the other, and the legacy one is the fallback shape.
  LegacyShareRoute,
  LocalProjectRoute
];

/**
 * Splits an internal path into what the patterns match and its query. A
 * pattern's parameter stops only at a `/`, so a query left on the path would
 * become part of the last one.
 */
function splitPath(path: string): { pathname: string; query: URLSearchParams } {
  const end = path.search(/[?#]/);
  if (end === -1) return { pathname: path, query: new URLSearchParams() };

  const hash = path.indexOf('#', end);
  return {
    pathname: path.slice(0, end),
    query: new URLSearchParams(path.slice(end, hash === -1 ? undefined : hash))
  };
}

@Injectable({
  providedIn: 'root'
})
export class RouterService {
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);

  private _routes: {
    instance: Route;
    keys: string[];
    pattern: RegExp;
  }[] = [];

  constructor() {
    for (const route of ROUTES) {
      const instance = inject(route);
      this._routes.push({
        ...parse(instance.route),
        instance
      });
    }
  }

  /**
   * Rewrites the address the editor was opened at into the form it writes
   * itself (`/editor/` → `/editor`), in place. The startup calls it before it
   * first reads the address or writes one, so no stale entry is left behind.
   */
  public canonicalizeAddress(): void {
    canonicalizeAddress(this.location, this.document.location);
  }

  public async processCurrentRoute(): Promise<void> {
    const path = this.location.path();
    if (!(await this.processPath(path))) {
      this.toast.error(
        this.translation.translate('routing.notFound'),
        'RouterService',
        `No route found for path: ${path}`
      );
      this.location.replaceState('/');
    }
  }

  /**
   * Whether any route's pattern matches `path`, its query aside, which the
   * startup decides the blank draft on — it creates one when *no* pattern
   * matches.
   *
   * **A pattern match implies the route activates.** A route that can turn a
   * path away has to say so in its pattern instead: a path matched and then
   * declined has already been claimed, no later pattern being tried, and the
   * `false` it leaves behind is indistinguishable from a path no pattern
   * matched. This one runs *before* the route does, so it reports `true` for
   * such a path, the startup skips its blank draft, and the reader is left with
   * a not-found toast, a rewritten URL and an empty main slot. The share routes
   * state their kinds literally for this reason.
   */
  public matches(path: string): boolean {
    const { pathname } = splitPath(path);
    return this._routes.some((route) => route.pattern.test(pathname));
  }

  public async navigate(path: string): Promise<boolean> {
    if (await this.processPath(path)) {
      this.location.go(path);
      return true;
    }

    return false;
  }

  private async processPath(path: string): Promise<boolean> {
    const { pathname, query } = splitPath(path);
    if (pathname === '' || pathname === '/') {
      return true;
    }

    for (const route of this._routes) {
      const match = route.pattern.exec(pathname);
      if (!match) {
        continue;
      }

      const params: RouteKeys<typeof pathname> = {};

      for (let i = 0; i < route.keys.length; i++) {
        params[route.keys[i]] = match[i + 1] ?? null;
      }

      // @ts-expect-error Some unfortunate type issues
      if (await route.instance.onActivation(params, query)) {
        this.logging.debug(
          { path, route: route.instance.route, params },
          'RouterService'
        );
        return true;
      }
    }

    return false;
  }
}
