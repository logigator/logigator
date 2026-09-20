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
import { Location } from '@angular/common';
import { parse } from 'regexparam';
import { RouteKeys } from './route-keys.model';
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

@Injectable({
  providedIn: 'root'
})
export class RouterService {
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);

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
   * Whether any route's pattern matches `path`, which the startup decides the
   * blank draft on — it creates one when *no* pattern matches.
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
    return [...this._routes.values()].some((route) => route.pattern.test(path));
  }

  public async navigate(path: string): Promise<boolean> {
    if (await this.processPath(path)) {
      this.location.go(path);
      return true;
    }

    return false;
  }

  private async processPath(path: string): Promise<boolean> {
    if (path === '' || path === '/') {
      return true;
    }

    for (const route of this._routes) {
      const match = route.pattern.exec(path);
      if (!match) {
        continue;
      }

      const params: RouteKeys<typeof path> = {};

      for (let i = 0; i < route.keys.length; i++) {
        params[route.keys[i]] = match[i + 1] ?? null;
      }

      // @ts-expect-error Some unfortunate type issues
      if (await route.instance.onActivation(params)) {
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
