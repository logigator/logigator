import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, Routes } from '@angular/router';
import { isAvailableLanguage } from '@logigator/core';
import { resolveDocumentLanguage } from './translation/document-language';
import { languageTableGuard } from './translation/language-guard';
import { HomePage } from './pages/home/home-page';
import { homeContentGuard } from './pages/home/home-content.guard';
import { homeJsonLd } from './pages/home/home-json-ld';
import { ExamplesPage } from './pages/examples/examples-page';
import { examplesContentGuard } from './pages/examples/examples-content.guard';
import { docsRoutes } from './pages/docs/docs-routes';
import { communityRoutes } from './pages/community/community-routes';
import { myRoutes } from './pages/my/my-routes';
import { ChangelogPage } from './pages/changelog/changelog-page';
import { changelogContentGuard } from './pages/changelog/changelog-content.guard';
import { LegalPage } from './pages/legal/legal-page';
import { legalContentGuard } from './pages/legal/legal-content.guard';
import { LegalRouteData } from './pages/legal/legal-document';
import { LoginPage } from './pages/auth/login/login-page';
import { RegisterPage } from './pages/auth/register/register-page';
import { ResetPasswordPage } from './pages/auth/reset-password/reset-password-page';
import { VerifyEmailPage } from './pages/auth/verify-email/verify-email-page';
import { NotFoundPage } from './pages/not-found/not-found-page';
import { authProvidersGuard, guestGuard } from './user/auth-guards';
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
    canActivate: [homeContentGuard],
    data: {
      seo: {
        titleKey: 'pages.home.title',
        jsonLd: homeJsonLd
      } satisfies PageMeta
    }
  },
  {
    path: 'examples',
    component: ExamplesPage,
    canActivate: [examplesContentGuard],
    data: {
      seo: {
        titleKey: 'pages.examples.title',
        descriptionKey: 'pages.examples.lede'
      } satisfies PageMeta
    }
  },
  ...docsRoutes,
  ...communityRoutes,
  ...myRoutes,
  {
    path: 'changelog',
    component: ChangelogPage,
    canActivate: [changelogContentGuard],
    data: {
      seo: {
        titleKey: 'pages.changelog.title',
        descriptionKey: 'pages.changelog.lede',
        feedPath: '/changelog.atom'
      } satisfies PageMeta
    }
  },
  // Two documents, one page: which text it renders is route data, and the
  // guard loads it before the first byte.
  {
    path: 'imprint',
    component: LegalPage,
    canActivate: [legalContentGuard],
    data: {
      legalDocument: 'imprint',
      seo: {
        titleKey: 'pages.imprint.title',
        descriptionKey: 'pages.imprint.lede'
      } satisfies PageMeta
    } satisfies LegalRouteData & { seo: PageMeta }
  },
  {
    path: 'privacy-policy',
    component: LegalPage,
    canActivate: [legalContentGuard],
    data: {
      legalDocument: 'privacy-policy',
      seo: {
        titleKey: 'pages.privacyPolicy.title',
        descriptionKey: 'pages.privacyPolicy.lede'
      } satisfies PageMeta
    } satisfies LegalRouteData & { seo: PageMeta }
  },
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard, authProvidersGuard],
    data: { seo: { titleKey: 'pages.login.title' } satisfies PageMeta }
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [guestGuard, authProvidersGuard],
    data: { seo: { titleKey: 'pages.register.title' } satisfies PageMeta }
  },
  // One page for both halves of a reset: the mail links straight to it with a
  // `?token=`, and without one it asks for the address to mail.
  {
    path: 'reset-password',
    component: ResetPasswordPage,
    data: { seo: { titleKey: 'pages.resetPassword.title' } satisfies PageMeta }
  },
  // The token is a path segment because that is the shape the API's mails
  // build, and those links are already in inboxes.
  {
    path: 'verify-email/:token',
    component: VerifyEmailPage,
    // No trail: an item naming this page would name the token in it.
    data: {
      seo: {
        titleKey: 'pages.verifyEmail.title',
        breadcrumb: false
      } satisfies PageMeta
    }
  },
  {
    path: '**',
    component: NotFoundPage,
    // No trail: the URL is not a page, so it is not a step towards one.
    data: {
      seo: {
        titleKey: 'pages.notFound.title',
        breadcrumb: false
      } satisfies PageMeta
    }
  }
];

export const routes: Route[] = [
  {
    path: ':lang',
    canMatch: [languagePrefix],
    canActivate: [languageTableGuard],
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
