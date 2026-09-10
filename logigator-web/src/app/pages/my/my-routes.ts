import { Routes } from '@angular/router';
import { PageMeta } from '../../seo/seo.service';
import { authGuard, authProvidersGuard } from '../../user/auth-guards';
import { CommunityRouteData } from '../community/community-kind';
import { AccountPage } from './account/account-page';
import { MyDocumentsPage } from './my-documents-page';
import { myDocumentsGuard } from './my-documents.guard';

/**
 * Both controls on a shelf write a query parameter, and the router's default
 * only re-runs a guard when a *path* parameter changes — so without this a
 * paginator click would rewrite the URL and leave the rows alone.
 */
const ON_QUERY_CHANGE = 'paramsOrQueryParamsChange' as const;

/**
 * The reader's own half of the site: two shelves and the account behind them.
 *
 * `authGuard` runs first on every one, and a `UrlTree` from a guard is a real
 * `302` during a server render — so an anonymous visitor is redirected by the
 * server rather than shown a page that empties itself after hydration. Nothing
 * here is indexable, and every route carries `breadcrumb: false`: a crumb trail
 * through pages a crawler can never reach describes nothing.
 */
export const myRoutes: Routes = [
  { path: 'my', pathMatch: 'full', redirectTo: 'my/projects' },
  {
    path: 'my/projects',
    component: MyDocumentsPage,
    canActivate: [authGuard, myDocumentsGuard],
    runGuardsAndResolvers: ON_QUERY_CHANGE,
    data: {
      communityKind: 'projects',
      seo: {
        titleKey: 'pages.my.projects.title',
        breadcrumb: false
      } satisfies PageMeta
    } satisfies CommunityRouteData & { seo: PageMeta }
  },
  {
    path: 'my/components',
    component: MyDocumentsPage,
    canActivate: [authGuard, myDocumentsGuard],
    runGuardsAndResolvers: ON_QUERY_CHANGE,
    data: {
      communityKind: 'components',
      seo: {
        titleKey: 'pages.my.components.title',
        breadcrumb: false
      } satisfies PageMeta
    } satisfies CommunityRouteData & { seo: PageMeta }
  },
  {
    path: 'my/account',
    component: AccountPage,
    // The sign-in methods too: the Google section is drawn only where the
    // deployment offers the round trip, and a section that appeared after
    // hydration would move everything under it.
    canActivate: [authGuard, authProvidersGuard],
    data: {
      seo: {
        titleKey: 'pages.my.account.title',
        breadcrumb: false
      } satisfies PageMeta
    }
  }
];
