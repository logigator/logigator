import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, Routes } from '@angular/router';
import { isAvailableLanguage } from './translation/languages';
import { resolveDocumentLanguage } from './translation/document-language';
import { HomePage } from './pages/home/home-page';
import { NotFoundPage } from './pages/not-found/not-found-page';
import { PageMeta } from './seo/seo.service';

/**
 * Matches only a first segment that names a language the site renders. Without
 * it `:lang` would swallow every URL, and `/nonsense` would render the home
 * page in a language nobody asked for instead of a 404.
 */
const languagePrefix: CanMatchFn = (_route, segments) =>
  isAvailableLanguage(segments[0]?.path);

/** Routes below the language prefix; every page the site has lives here. */
const localizedRoutes: Routes = [
  {
    path: '',
    component: HomePage,
    data: { seo: { titleKey: 'pages.home.title' } satisfies PageMeta }
  },
  {
    path: '**',
    component: NotFoundPage,
    data: { seo: { titleKey: 'pages.notFound.title' } satisfies PageMeta }
  }
];

export const routes: Route[] = [
  {
    path: ':lang',
    canMatch: [languagePrefix],
    children: localizedRoutes
  },
  // A URL carrying no language. The SSR server redirects one before Angular
  // sees it, so this is reached by an in-app navigation, where the document's
  // language is settled and is the prefix to add. A first segment that is not a
  // language then lands on the localized `**`, which is the real 404.
  //
  // A `UrlTree` rather than a path string: for a string target the router takes
  // the query and fragment from that target alone, so the ones the page is on
  // would be dropped.
  {
    path: '**',
    redirectTo: (data) =>
      inject(Router).createUrlTree(
        [
          '/',
          resolveDocumentLanguage(),
          ...data.url.map((segment) => segment.path)
        ],
        { queryParams: data.queryParams, fragment: data.fragment ?? undefined }
      )
  }
];
