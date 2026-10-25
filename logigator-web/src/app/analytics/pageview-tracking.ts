import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  PLATFORM_ID,
  provideAppInitializer
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, skip } from 'rxjs/operators';
import { AnalyticsService } from './analytics.service';

/**
 * Reports a `$pageview` for every navigation after the first.
 *
 * PostHog's `init` captures one for the document load, which is all the legacy
 * pages ever needed — each of them *was* a document load. Here a visitor moving
 * between pages stays in one document, so without this every session would
 * count as a single page view.
 *
 * The capture is unconditional: `AnalyticsService` drops it until the visitor
 * has granted the `analytics` category, so a declining session silently does
 * nothing.
 */
export function providePageviewTracking(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      if (isPlatformServer(inject(PLATFORM_ID))) {
        return;
      }
      const destroyRef = inject(DestroyRef);
      const analytics = inject(AnalyticsService);
      inject(Router)
        .events.pipe(
          filter((event) => event instanceof NavigationEnd),
          // The initial navigation is the document load `init` already counted.
          skip(1),
          takeUntilDestroyed(destroyRef)
        )
        .subscribe(() => analytics.capture('$pageview'));
    })
  ]);
}
