import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, Routes } from '@angular/router';
import { isAvailableLanguage } from '@logigator/core';
import { resolveDocumentLanguage } from './translation/document-language';
import { languageTableGuard } from './translation/language-guard';
import { HomePage } from './pages/home/home-page';
import { homeContentGuard } from './pages/home/home-content.guard';
import { ExamplesPage } from './pages/examples/examples-page';
import { examplesContentGuard } from './pages/examples/examples-content.guard';
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
    data: { seo: { titleKey: 'pages.home.title' } satisfies PageMeta }
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
    data: { seo: { titleKey: 'pages.verifyEmail.title' } satisfies PageMeta }
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
