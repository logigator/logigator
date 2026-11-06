import {
  EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
  REQUEST_CONTEXT
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Event,
  PRIMARY_OUTLET,
  Router,
  RoutesRecognized
} from '@angular/router';
import { filter, take } from 'rxjs';
import { recordRenderRoute } from '../render-context';

/**
 * The path template of the primary route a snapshot matched, such as
 * `/:lang/community/projects/:link`; a wildcard match contributes `**`.
 */
export function routeTemplate(root: ActivatedRouteSnapshot): string {
  const paths: string[] = [];
  for (
    let route: ActivatedRouteSnapshot | undefined = root;
    route;
    route = route.children.find((child) => child.outlet === PRIMARY_OUTLET)
  ) {
    const path = route.routeConfig?.path;
    if (path) paths.push(path);
  }
  return `/${paths.join('/')}`;
}

/**
 * Writes the template of the route a render's request matched into its
 * `REQUEST_CONTEXT`. The first recognition counts, so a guard's redirect is
 * credited to the page that was asked for.
 */
export function provideRenderRoute(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const context = inject(REQUEST_CONTEXT, { optional: true });
    if (!context) return;
    inject(Router)
      .events.pipe(
        filter(
          (event: Event): event is RoutesRecognized =>
            event instanceof RoutesRecognized
        ),
        take(1)
      )
      .subscribe((event) =>
        recordRenderRoute(context, routeTemplate(event.state.root))
      );
  });
}
